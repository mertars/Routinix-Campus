import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { resolveScope } from "@/lib/server/sms/scope-resolver";
import { sendPersonalizedNotification } from "@/lib/server/sms/notification-service";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Not: export EDİLMEZ — Next.js route dosyaları sadece GET/POST/dynamic gibi
// bilinen isimleri export edebilir, fazlası derleme hatasına yol açar.
// İstemci bu şablonu GET yanıtındaki defaultTemplate alanından alır.
const DEFAULT_REMINDER_TEMPLATE =
  "Sayın {veli_adi}, {ogrenci_adi} adlı öğrencimizin {tutar} tutarında vadesi geçmiş ödemesi bulunmaktadır. Bilgilerinize sunarız.";

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Vadesi geçmiş taksitleri ÖĞRENCİ bazında toplar — bir öğrencinin 3 geciken
// taksiti varsa veliye 3 ayrı SMS DEĞİL, toplam tutarı içeren TEK SMS gider
// (hem kontör tasarrufu hem de veli deneyimi için).
async function collectOverdueByStudent(institutionId: string) {
  const now = new Date();
  const overdue = await prisma.installment.findMany({
    where: { institutionId, status: { in: ["PENDING", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const byStudent = new Map<
    string,
    { studentId: string; studentName: string; totalRemaining: number; oldestDueDate: Date; installmentIds: string[]; lastReminderAt: Date | null }
  >();

  for (const inst of overdue) {
    const paid = inst.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Number(inst.amount) - paid;
    if (remaining <= 0) continue;

    const existing = byStudent.get(inst.studentId);
    if (existing) {
      existing.totalRemaining += remaining;
      existing.installmentIds.push(inst.id);
      if (inst.lastReminderAt && (!existing.lastReminderAt || inst.lastReminderAt > existing.lastReminderAt)) {
        existing.lastReminderAt = inst.lastReminderAt;
      }
    } else {
      byStudent.set(inst.studentId, {
        studentId: inst.studentId,
        studentName: `${inst.student.firstName} ${inst.student.lastName}`,
        totalRemaining: remaining,
        oldestDueDate: inst.dueDate,
        installmentIds: [inst.id],
        lastReminderAt: inst.lastReminderAt,
      });
    }
  }

  return [...byStudent.values()];
}

// GET — önizleme: kim alacak, kaç SMS gidecek, kontör yeter mi. Gönderimden
// ÖNCE yöneticiye net bir maliyet/etki tablosu göstermek için.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const targets = await collectOverdueByStudent(session.institutionId);
    // Aktif ödeme sözü olan veliye hatırlatma göndermek gereksiz baskıdır —
    // veli zaten "şu tarihte ödeyeceğim" demiş ve tarih henüz geçmemiş.
    // Bu öğrenciler listede GÖRÜNÜR ama varsayılan olarak SEÇİLMEZ.
    const activePromises = await prisma.paymentPromise.findMany({
      where: { institutionId: session.institutionId, closedAt: null, promisedDate: { gte: new Date() } },
      select: { studentId: true, promisedDate: true },
    });
    const promiseByStudent = new Map(activePromises.map((p) => [p.studentId, p.promisedDate]));

    const [institution, recipients] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { smsCredits: true } }),
      targets.length > 0 ? resolveScope("CUSTOM_ID_LIST", targets.map((t) => t.studentId).join(","), session.institutionId) : Promise.resolve([]),
    ]);

    // smsConsent'i olmayan velilerin öğrencileri gönderim listesinde YER ALMAZ
    // (resolveScope filtreliyor) — yöneticiye bunu açıkça göstermek için
    // ulaşılabilir/ulaşılamaz ayrımı yapılıyor.
    const reachableStudentIds = new Set(recipients.map((r) => r.studentId));

    return NextResponse.json({
      defaultTemplate: DEFAULT_REMINDER_TEMPLATE,
      smsCredits: institution?.smsCredits ?? 0,
      recipientCount: recipients.length,
      targets: targets.map((t) => ({
        studentId: t.studentId,
        studentName: t.studentName,
        totalRemaining: t.totalRemaining,
        oldestDueDate: t.oldestDueDate.toISOString(),
        installmentCount: t.installmentIds.length,
        lastReminderAt: t.lastReminderAt?.toISOString() ?? null,
        isReachable: reachableStudentIds.has(t.studentId),
        promisedDate: promiseByStudent.get(t.studentId)?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_reminders_preview_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { studentIds?: string[], messageBody? }
// studentIds verilmezse gecikmiş ödemesi olan TÜM öğrencilerin velilerine
// gönderilir. Kontör kontrolü/düşümü admin/sms/send ile AYNI desende
// (bkz. oradaki yarış durumu notu).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const selectedIds: string[] | null = Array.isArray(body?.studentIds) ? body.studentIds.filter((id: unknown) => typeof id === "string") : null;
    const messageBody = (body?.messageBody as string | undefined)?.trim() || DEFAULT_REMINDER_TEMPLATE;

    const all = await collectOverdueByStudent(session.institutionId);
    const targets = selectedIds && selectedIds.length > 0 ? all.filter((t) => selectedIds.includes(t.studentId)) : all;
    if (targets.length === 0) return NextResponse.json({ error: "Gecikmiş ödemesi olan öğrenci bulunamadı." }, { status: 400 });

    const recipients = await resolveScope("CUSTOM_ID_LIST", targets.map((t) => t.studentId).join(","), session.institutionId);
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Seçili öğrencilerin velisinde SMS onayı (smsConsent) yok." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { smsCredits: true } });
    const availableCredits = institution?.smsCredits ?? 0;
    if (availableCredits < recipients.length) {
      return NextResponse.json(
        { error: `Yetersiz SMS kontörü: ${recipients.length} alıcı için kontör gerekiyor, mevcut bakiye ${availableCredits}.` },
        { status: 402 }
      );
    }

    await prisma.institution.update({ where: { id: session.institutionId }, data: { smsCredits: { decrement: recipients.length } } });

    const result = await sendPersonalizedNotification({
      institutionId: session.institutionId,
      templateBody: messageBody,
      targets: targets.map((t) => ({
        studentId: t.studentId,
        params: {
          tutar: formatTRY(t.totalRemaining),
          son_odeme: t.oldestDueDate.toLocaleDateString("tr-TR"),
          taksit_sayisi: String(t.installmentIds.length),
        },
      })),
    });

    // Hatırlatma zamanını SADECE gerçekten gönderilen öğrencilerin
    // taksitlerine yaz (smsConsent'i olmayanlar hariç kalır).
    const sentStudentIds = new Set(recipients.map((r) => r.studentId));
    const remindedInstallmentIds = targets.filter((t) => sentStudentIds.has(t.studentId)).flatMap((t) => t.installmentIds);
    if (remindedInstallmentIds.length > 0) {
      await prisma.installment.updateMany({ where: { id: { in: remindedInstallmentIds } }, data: { lastReminderAt: new Date() } });
    }

    return NextResponse.json({ ...result, remainingCredits: availableCredits - recipients.length }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_reminders_send_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/reminders", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/reminders", handlePost);
