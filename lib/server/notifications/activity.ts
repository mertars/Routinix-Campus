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
 * Tekrar etmeyen bildirim — ZAMANLANMIŞ (cron) işler için.
 *
 * ⚠️ Neden gerekli: "kayıt süresi bitmek üzere" gibi uyarıları üreten cron
 * HER GÜN çalışır. Sıradan notify() kullanılsaydı aynı öğrenci için aynı
 * uyarı her sabah yeniden düşer, kutu bir haftada kullanılamaz hâle gelirdi.
 * Burada aynı (alıcı + olay + başlık) üçlüsü verilen pencere içinde zaten
 * varsa ATLANIR.
 */
export async function notifyOnce(input: NotifyInput & { withinHours: number }): Promise<void> {
  try {
    const since = new Date(Date.now() - input.withinHours * 3_600_000);
    const fresh: NotifyRecipient[] = [];
    for (const r of input.recipients) {
      const existing = await prisma.activityNotification.findFirst({
        where: {
          recipientRole: r.role,
          recipientId: r.id,
          eventType: input.eventType,
          title: input.title,
          createdAt: { gte: since },
        },
        select: { id: true },
      });
      if (!existing) fresh.push(r);
    }
    if (fresh.length === 0) return;
    await notify({ ...input, recipients: fresh });
  } catch (error) {
    logger.error("activity_notification_once_failed", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
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
