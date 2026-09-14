import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { findMissingAttendance } from "@/lib/server/attendance/missing-attendance";
import { notifyManyOnce, actorNameOf } from "@/lib/server/notifications/activity";

export const dynamic = "force-dynamic";

// POST /api/admin/agenda/remind-attendance — Gündem'deki "X derste yoklama
// girilmedi" kartının SATIR İÇİ eylemi.
//
// ⚠️ NEDEN VAR (kullanıcı kararı, 2026-09-15): "gündem bildirimler bir
// yöneticinin en çok kullanacağı yerler olacak, bütün işlerini onlara
// basarak yapacak". Bu madde yöneticinin her gün tekrarlayan işi ve
// cevabı HER ZAMAN aynı: ilgili öğretmene "yoklamayı gir" demek.
// Önceden bunun için Gündem'den yoklama ekranına gidip eksikleri tekrar
// bulmak ve uygulama DIŞINDAN (telefon/WhatsApp) haber vermek gerekiyordu.
//
// Burası Gündem'i (ne eksik) Bildirim kutusuna (kime söylenecek) bağlar:
// iki sistem de zaten vardı ama birbirine bağlı değildi.
//
// ⚠️ notifyManyOnce: aynı öğretmene aynı gün ikinci kez basılırsa tekrar
// bildirim YAZILMAZ (yönetici sabırsızlanıp üst üste tıklayabilir).
async function handlePost(_request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const report = await findMissingAttendance(session.institutionId, new Date());
    if (report.missing.length === 0) {
      return NextResponse.json({ ok: true, notified: 0, message: "Eksik yoklama kalmamış." });
    }

    // Öğretmen başına tek bildirim — bir öğretmenin 3 dersi eksikse
    // 3 ayrı bildirim değil, tek satırda hepsi.
    const byTeacher = new Map<string, { name: string; lessons: string[] }>();
    for (const m of report.missing) {
      const entry = byTeacher.get(m.teacherId) ?? { name: m.teacherName, lessons: [] };
      entry.lessons.push(`${m.branchName} ${m.slot}`);
      byTeacher.set(m.teacherId, entry);
    }

    const actor = await actorNameOf(session.role, session.sub);
    const items = [...byTeacher.entries()].map(([teacherId, info]) => ({
      institutionId: session.institutionId,
      recipients: [{ role: "TEACHER" as const, id: teacherId }],
      eventType: "attendance.missing" as const,
      title:
        info.lessons.length === 1
          ? "Yoklama girilmemiş bir dersin var"
          : `Yoklama girilmemiş ${info.lessons.length} dersin var`,
      body: `${report.dayName} · ${info.lessons.join(" · ")}`,
      href: "/teacher?tab=attendance",
      actorName: actor,
      urgent: true,
    }));

    // 12 saat: aynı gün içinde tekrar basılırsa mükerrer yazılmaz,
    // ertesi gün yeniden hatırlatılabilir.
    const notified = await notifyManyOnce(items, 12);

    return NextResponse.json({
      ok: true,
      notified,
      teachers: byTeacher.size,
      message:
        notified > 0
          ? `${byTeacher.size} öğretmene hatırlatma gönderildi.`
          : "Bu öğretmenlere bugün zaten hatırlatma gönderilmiş.",
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("agenda_remind_attendance_failed", error);
  }
}

export const POST = withApiLogging("POST /api/admin/agenda/remind-attendance", handlePost);
