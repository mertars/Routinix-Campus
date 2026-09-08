import { prisma } from "@/lib/server/prisma";
import { resolveScope } from "@/lib/server/sms/scope-resolver";
import { sendPersonalizedNotification } from "@/lib/server/sms/notification-service";
import { logger } from "@/lib/logger";

// Aynı veliye en sık kaç günde bir hatırlatma gidebilir.
//
// Vadesi geçmiş borç her gün geçmiş kalır; gün başına bir SMS atmak hem
// kontörü yakar hem de veliyi bunaltır. Haftada bir, borcu hatırlatmaya
// yeter ve taciz sınırının altında kalır.
export const REMINDER_REPEAT_DAYS = 7;

export const DEFAULT_BEFORE_TEMPLATE =
  "Sayın {veli_adi}, {ogrenci_adi} adlı öğrencimizin {tutar} tutarındaki taksitinin son ödeme tarihi {son_odeme}. Bilgilerinize sunarız.";

export const DEFAULT_AFTER_TEMPLATE =
  "Sayın {veli_adi}, {ogrenci_adi} adlı öğrencimizin {tutar} tutarında vadesi geçmiş ödemesi bulunmaktadır. Bilgilerinize sunarız.";

export type ReminderTarget = {
  studentId: string;
  studentName: string;
  totalRemaining: number;
  keyDueDate: Date;
  installmentIds: string[];
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Taksitleri ÖĞRENCİ bazında toplar — bir öğrencinin 3 geciken taksiti
// varsa veliye 3 ayrı SMS DEĞİL, toplam tutarı içeren TEK SMS gider.
function groupByStudent(
  rows: {
    id: string;
    dueDate: Date;
    amount: unknown;
    student: { id: string; firstName: string; lastName: string };
    payments: { amount: unknown }[];
  }[]
): ReminderTarget[] {
  const byStudent = new Map<string, ReminderTarget>();
  for (const inst of rows) {
    const remaining = Number(inst.amount) - inst.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    if (remaining <= 0.009) continue;

    const existing = byStudent.get(inst.student.id);
    if (existing) {
      existing.totalRemaining += remaining;
      existing.installmentIds.push(inst.id);
      if (inst.dueDate < existing.keyDueDate) existing.keyDueDate = inst.dueDate;
    } else {
      byStudent.set(inst.student.id, {
        studentId: inst.student.id,
        studentName: `${inst.student.firstName} ${inst.student.lastName}`,
        totalRemaining: remaining,
        keyDueDate: inst.dueDate,
        installmentIds: [inst.id],
      });
    }
  }
  return [...byStudent.values()];
}

const INCLUDE = {
  student: { select: { id: true, firstName: true, lastName: true } },
  payments: { where: { status: "COMPLETED" as const }, select: { amount: true } },
};

// Vadesi YAKLAŞAN taksitler: bugün ile bugün+daysBefore arası.
// Hiç hatırlatılmamış olanlar (lastReminderAt null) — vadesi gelmemiş bir
// taksit için tekrar tekrar hatırlatmanın anlamı yok.
export async function collectDueSoon(institutionId: string, daysBefore: number): Promise<ReminderTarget[]> {
  if (daysBefore <= 0) return [];
  const today = startOfToday();
  const until = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysBefore + 1);

  const rows = await prisma.installment.findMany({
    where: {
      institutionId,
      status: { in: ["PENDING", "PARTIALLY_PAID"] },
      dueDate: { gte: today, lt: until },
      lastReminderAt: null,
    },
    include: INCLUDE,
    orderBy: { dueDate: "asc" },
  });
  return groupByStudent(rows);
}

// Vadesi GEÇMİŞ taksitler: en az daysAfter gün gecikmiş olanlar.
// REMINDER_REPEAT_DAYS içinde hatırlatılmışlar hariç.
export async function collectOverdue(institutionId: string, daysAfter: number): Promise<ReminderTarget[]> {
  if (daysAfter <= 0) return [];
  const today = startOfToday();
  const cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAfter + 1);
  const repeatCutoff = new Date(Date.now() - REMINDER_REPEAT_DAYS * 86_400_000);

  const rows = await prisma.installment.findMany({
    where: {
      institutionId,
      status: { in: ["PENDING", "PARTIALLY_PAID"] },
      dueDate: { lt: cutoff },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: repeatCutoff } }],
    },
    include: INCLUDE,
    orderBy: { dueDate: "asc" },
  });
  return groupByStudent(rows);
}

export type SendResult = { sent: number; skippedNoConsent: number; skippedNoCredit: number };

// Hatırlatma gönderimi — elle ve otomatik akışın ORTAK yolu.
//
// Üç sessiz eleme var ve üçü de ayrı ayrı raporlanır: SMS onayı olmayan
// veliler (KVKK, resolveScope filtreler), kontör yetmezliği ve zaten
// hatırlatılmış taksitler. "Gönderildi: 0" demek yerine NEDENİNİ
// söylemek, müdürün sorunu çözebilmesi için şart.
export async function sendReminders(
  institutionId: string,
  targets: ReminderTarget[],
  templateBody: string
): Promise<SendResult> {
  if (targets.length === 0) return { sent: 0, skippedNoConsent: 0, skippedNoCredit: 0 };

  const recipients = await resolveScope("CUSTOM_ID_LIST", targets.map((t) => t.studentId).join(","), institutionId);
  const consented = new Set(recipients.map((r) => r.studentId));
  const skippedNoConsent = targets.length - consented.size;
  if (recipients.length === 0) return { sent: 0, skippedNoConsent, skippedNoCredit: 0 };

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { smsCredits: true },
  });
  const credits = institution?.smsCredits ?? 0;
  if (credits < recipients.length) {
    // Kısmi gönderim YAPILMAZ: "kimin SMS aldığı" kontör bakiyesine göre
    // rastgele belirlenirdi. Ya hepsi gider ya hiçbiri; müdür kontör
    // yükleyip tekrar dener.
    return { sent: 0, skippedNoConsent, skippedNoCredit: recipients.length };
  }

  await prisma.institution.update({
    where: { id: institutionId },
    data: { smsCredits: { decrement: recipients.length } },
  });

  const sendable = targets.filter((t) => consented.has(t.studentId));
  await sendPersonalizedNotification({
    institutionId,
    templateBody,
    targets: sendable.map((t) => ({
      studentId: t.studentId,
      params: {
        tutar: formatTRY(t.totalRemaining),
        son_odeme: t.keyDueDate.toLocaleDateString("tr-TR"),
        taksit_sayisi: String(t.installmentIds.length),
      },
    })),
  });

  // Hatırlatma zamanı SADECE gerçekten gönderilenlere yazılır.
  const ids = sendable.flatMap((t) => t.installmentIds);
  if (ids.length > 0) {
    await prisma.installment.updateMany({ where: { id: { in: ids } }, data: { lastReminderAt: new Date() } });
  }

  logger.info("payment_reminders_sent", { institutionId, sent: sendable.length, skippedNoConsent });
  return { sent: sendable.length, skippedNoConsent, skippedNoCredit: 0 };
}
