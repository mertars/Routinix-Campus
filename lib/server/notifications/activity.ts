import { prisma } from "@/lib/server/prisma";
import { logger } from "@/lib/logger";
import { eventMeta, type ActivityAudience, type NotificationEventType } from "@/lib/notifications/events";

// UYGULAMA İÇİ BİLDİRİM YAYIMCISI.
//
// ⚠️ TEK KURAL: bu dosyadaki hiçbir fonksiyon ASLA hata FIRLATMAZ. Bildirim
// yan bir kayıttır — yoklama kaydedilirken bildirim yazılamazsa yoklamanın
// kendisi başarısız OLMAMALI. Bu yüzden her şey try/catch içinde, hata
// sadece loglanır (audit-log'daki AYNI "ateşle ve unut" deseni, bkz.
// lib/server/audit/audit-log.ts).
//
// Çağıran taraf `await notify(...)` yazabilir ama `.catch()` eklemek
// zorunda değildir.

export type NotifyRecipient = { role: ActivityAudience; id: string };

type NotifyInput = {
  institutionId: string;
  recipients: NotifyRecipient[];
  eventType: NotificationEventType;
  title: string;
  body?: string | null;
  href?: string | null;
  actorName?: string | null;
  /** Katalogdaki varsayılanı ezer. */
  urgent?: boolean;
};

export async function notify(input: NotifyInput): Promise<void> {
  try {
    const meta = eventMeta(input.eventType);
    // Aynı kişiye aynı olaydan iki satır yazılmasın (ör. hem şube
    // öğrencisi hem veli listesinde iki kez görünen bir id).
    const seen = new Set<string>();
    const rows = input.recipients
      .filter((r) => {
        if (!r.id) return false;
        const key = `${r.role}:${r.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((r) => ({
        institutionId: input.institutionId,
        recipientRole: r.role,
        recipientId: r.id,
        category: meta.category,
        eventType: input.eventType,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        actorName: input.actorName ?? null,
        urgent: input.urgent ?? meta.urgent ?? false,
      }));

    if (rows.length === 0) return;
    await prisma.activityNotification.createMany({ data: rows });
  } catch (error) {
    logger.error("activity_notification_failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Tekrar etmeyen bildirimleri TOPLU yaz — ZAMANLANMIŞ (cron) işler için.
 *
 * ⚠️ Neden "once": "kayıt süresi bitmek üzere" gibi uyarıları üreten cron HER
 * GÜN çalışır. Sıradan notify() kullanılsaydı aynı uyarı her sabah yeniden
 * düşer, kutu bir haftada kullanılamaz hâle gelirdi. Aynı
 * (alıcı + olay + başlık) üçlüsü pencere içinde zaten varsa ATLANIR.
 *
 * ⚠️ Neden TOPLU: ilk sürüm her alıcı için ayrı bir findFirst + ayrı insert
 * yapıyordu. Arslan Dershaneleri'nin GERÇEK verisiyle ölçüldü — 75 gecikmiş
 * taksit ≈ 375 sıralı gidiş-dönüş, Neon'da ~100-900 ms/sorgu, toplam
 * **59 saniye**. Vercel'in 60 sn fonksiyon sınırında bu doğrudan zaman
 * aşımı demekti. Artık kaç kalem olursa olsun SABİT 2 sorgu: bir okuma
 * (mevcutları topla) + bir createMany.
 */
export async function notifyManyOnce(
  items: (NotifyInput & { urgent?: boolean })[],
  withinHours: number
): Promise<number> {
  try {
    if (items.length === 0) return 0;
    const since = new Date(Date.now() - withinHours * 3_600_000);

    // Adayları düzleştir (kalem × alıcı).
    type Candidate = { key: string; row: ReturnType<typeof toRow> };
    function toRow(item: NotifyInput, r: NotifyRecipient) {
      const meta = eventMeta(item.eventType);
      return {
        institutionId: item.institutionId,
        recipientRole: r.role,
        recipientId: r.id,
        category: meta.category,
        eventType: item.eventType,
        title: item.title,
        body: item.body ?? null,
        href: item.href ?? null,
        actorName: item.actorName ?? null,
        urgent: item.urgent ?? meta.urgent ?? false,
      };
    }

    const candidates: Candidate[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      for (const r of item.recipients) {
        if (!r.id) continue;
        const key = `${r.role}|${r.id}|${item.eventType}|${item.title}`;
        if (seen.has(key)) continue; // aynı çalıştırmada tekrar
        seen.add(key);
        candidates.push({ key, row: toRow(item, r) });
      }
    }
    if (candidates.length === 0) return 0;

    // TEK okuma: bu alıcılar + bu olay tipleri için penceredeki mevcut kayıtlar.
    const recipientIds = [...new Set(candidates.map((c) => c.row.recipientId))];
    const eventTypes = [...new Set(candidates.map((c) => c.row.eventType))];
    const existing = await prisma.activityNotification.findMany({
      where: {
        recipientId: { in: recipientIds },
        eventType: { in: eventTypes },
        createdAt: { gte: since },
      },
      select: { recipientRole: true, recipientId: true, eventType: true, title: true },
    });
    const existingKeys = new Set(existing.map((e) => `${e.recipientRole}|${e.recipientId}|${e.eventType}|${e.title}`));

    const fresh = candidates.filter((c) => !existingKeys.has(c.key)).map((c) => c.row);
    if (fresh.length === 0) return 0;

    // TEK yazma.
    await prisma.activityNotification.createMany({ data: fresh });
    return fresh.length;
  } catch (error) {
    logger.error("activity_notification_many_once_failed", {
      count: items.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Alıcı çözücüleri — "bu olaydan kim haberdar olmalı" sorusunun tek yeri.
// Hepsi hata durumunda BOŞ dizi döner (bildirim gitmez ama işlem sürer).
// ---------------------------------------------------------------------------

/** Kurumdaki tüm yöneticiler. */
export async function admins(institutionId: string): Promise<NotifyRecipient[]> {
  try {
    const rows = await prisma.admin.findMany({ where: { institutionId }, select: { id: true } });
    return rows.map((r) => ({ role: "ADMIN" as const, id: r.id }));
  } catch {
    return [];
  }
}

/** Bir öğrencinin velileri. */
export async function parentsOf(studentId: string): Promise<NotifyRecipient[]> {
  try {
    const links = await prisma.parentStudent.findMany({ where: { studentId }, select: { parentId: true } });
    return links.map((l) => ({ role: "PARENT" as const, id: l.parentId }));
  } catch {
    return [];
  }
}

/** Öğrencinin kendisi + velileri — "çocuğu ilgilendiren her şey" için kısayol. */
export async function studentAndParents(studentId: string): Promise<NotifyRecipient[]> {
  return [{ role: "STUDENT" as const, id: studentId }, ...(await parentsOf(studentId))];
}

/** Bir şubedeki tüm aktif öğrenciler. */
export async function studentsOfBranch(branchId: string): Promise<NotifyRecipient[]> {
  try {
    const rows = await prisma.student.findMany({ where: { branchId, isActive: true }, select: { id: true } });
    return rows.map((r) => ({ role: "STUDENT" as const, id: r.id }));
  } catch {
    return [];
  }
}

/** Bir şubedeki öğrencilerin velileri. */
export async function parentsOfBranch(branchId: string): Promise<NotifyRecipient[]> {
  try {
    const links = await prisma.parentStudent.findMany({
      where: { student: { branchId, isActive: true } },
      select: { parentId: true },
    });
    return links.map((l) => ({ role: "PARENT" as const, id: l.parentId }));
  } catch {
    return [];
  }
}

/** Bir şubeye ders veren öğretmenler. */
export async function teachersOfBranch(branchId: string): Promise<NotifyRecipient[]> {
  try {
    const rows = await prisma.teacher.findMany({
      where: { teachingBranches: { some: { id: branchId } }, isActive: true },
      select: { id: true },
    });
    return rows.map((r) => ({ role: "TEACHER" as const, id: r.id }));
  } catch {
    return [];
  }
}

/**
 * Rehberlik personeli. Rehberlik rolünün kimliği yine bir Teacher kaydıdır
 * (subject = "Rehberlik", bkz. app/api/guidance-referrals/route.ts) — ayrı
 * bir tablo YOK, bu yüzden burada da konudan süzülüyor.
 */
export async function guidanceStaff(institutionId: string): Promise<NotifyRecipient[]> {
  try {
    const rows = await prisma.teacher.findMany({
      where: { institutionId, subject: "Rehberlik", isActive: true },
      select: { id: true },
    });
    return rows.map((r) => ({ role: "GUIDANCE" as const, id: r.id }));
  } catch {
    return [];
  }
}

/** Tek bir öğretmen. */
export function teacher(teacherId: string): NotifyRecipient[] {
  return teacherId ? [{ role: "TEACHER", id: teacherId }] : [];
}

/** Tek bir öğrenci. */
export function student(studentId: string): NotifyRecipient[] {
  return studentId ? [{ role: "STUDENT", id: studentId }] : [];
}

/**
 * Bir öğrencinin adını "Ad S." biçiminde değil TAM olarak döner — bildirim
 * metni kurum içi ve alıcıya özel olduğu için kısaltmaya gerek yok
 * (global soru akışındaki gizlilik kuralı burada geçerli DEĞİL).
 */
export async function studentName(studentId: string): Promise<string> {
  try {
    const s = await prisma.student.findUnique({ where: { id: studentId }, select: { firstName: true, lastName: true } });
    return s ? `${s.firstName} ${s.lastName}` : "Öğrenci";
  } catch {
    return "Öğrenci";
  }
}

export async function teacherName(teacherId: string): Promise<string> {
  try {
    const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { firstName: true, lastName: true } });
    return t ? `${t.firstName} ${t.lastName}` : "Öğretmen";
  } catch {
    return "Öğretmen";
  }
}

export async function branchName(branchId: string): Promise<string> {
  try {
    const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
    return b?.name ?? "Şube";
  } catch {
    return "Şube";
  }
}

/**
 * Oturumdaki kişinin görünen adı — olayı YAPAN kişiyi bildirimde göstermek
 * için. Rol başına farklı tabloya bakar (kimlik tabloları ayrı).
 */
export async function actorNameOf(role: string, id: string): Promise<string | null> {
  try {
    if (role === "ADMIN") {
      const a = await prisma.admin.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
      return a ? `${a.firstName} ${a.lastName}` : null;
    }
    if (role === "TEACHER" || role === "GUIDANCE") return await teacherName(id);
    if (role === "STUDENT") return await studentName(id);
    if (role === "PARENT") {
      const p = await prisma.parent.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
      return p ? `${p.firstName} ${p.lastName}` : null;
    }
    return null;
  } catch {
    return null;
  }
}
