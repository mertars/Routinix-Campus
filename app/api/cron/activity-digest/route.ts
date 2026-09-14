import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getEnv } from "@/lib/server/env";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { notifyOnce, admins, parentsOf } from "@/lib/server/notifications/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/activity-digest — Vercel Cron GÜNLÜK çağırır (bkz. vercel.json).
//
// Olay güdümlü bildirimler (yoklama girildi, ödeme geldi...) ilgili API
// ucunda anında üretilir. Ama bazı uyarıların bir OLAYI yoktur — "kayıt
// süresi bitmek üzere" hiç kimse bir şey YAPMADIĞI için doğar, zamanın
// geçmesiyle. Kullanıcı isteğindeki "öğrencinin kayıt süresi bitmek üzere"
// örneği tam olarak bu sınıfa girer; bu yüzden zamanlanmış bir iş gerekiyor.
//
// ⚠️ HEPSİ notifyOnce ile yazılır: cron her gün koştuğu için sıradan
// notify() aynı uyarıyı her sabah tekrar düşürür, kutu bir haftada çöpe
// dönerdi (bkz. activity.ts > notifyOnce).
//
// ⚠️ Bir kurumdaki hata diğerlerini DURDURMAZ (payment-reminders'daki
// AYNI gerekçe) — her kurum kendi try bloğunda.

/** Kayıt bitişine bu kadar gün kalınca uyar. */
const ENROLLMENT_WARN_DAYS = 30;
/** Aynı uyarı bu pencere içinde tekrar yazılmaz. */
const DEDUPE_HOURS = 20 * 24;

async function handleGet(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  try {
    const institutions = await prisma.institution.findMany({ select: { id: true, name: true } });
    const now = new Date();
    const horizon = new Date(now.getTime() + ENROLLMENT_WARN_DAYS * 86_400_000);
    let enrollmentWarnings = 0;
    let overdueWarnings = 0;

    for (const institution of institutions) {
      try {
        const adminList = await admins(institution.id);
        if (adminList.length === 0) continue;

        // --- 1) Kayıt süresi bitmek üzere olan öğrenciler ---
        const expiring = await prisma.studentEnrollment.findMany({
          where: {
            institutionId: institution.id,
            status: "ACTIVE",
            endDate: { gte: now, lte: horizon },
          },
          select: {
            id: true,
            endDate: true,
            academicYear: true,
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        for (const enrollment of expiring) {
          const daysLeft = Math.max(0, Math.ceil((enrollment.endDate.getTime() - now.getTime()) / 86_400_000));
          const who = `${enrollment.student.firstName} ${enrollment.student.lastName}`;
          await notifyOnce({
            institutionId: institution.id,
            recipients: adminList,
            eventType: "student.enrollment_expiring",
            title: `${who} kaydının süresi bitmek üzere`,
            body: `${daysLeft} gün kaldı · ${enrollment.academicYear} · Bitiş ${enrollment.endDate.toLocaleDateString("tr-TR")}`,
            href: "/principal",
            urgent: daysLeft <= 7,
            withinHours: DEDUPE_HOURS,
          });
          enrollmentWarnings += 1;
        }

        // --- 2) Vadesi geçmiş taksitler ---
        const overdue = await prisma.installment.findMany({
          where: {
            institutionId: institution.id,
            status: { in: ["PENDING", "PARTIALLY_PAID"] },
            dueDate: { lt: now },
          },
          select: { id: true, title: true, dueDate: true, amount: true, studentId: true },
          take: 200,
        });

        // İsimler tek sorguda — taksit başına ayrı sorgu atmamak için.
        const overdueStudentIds = [...new Set(overdue.map((i) => i.studentId))];
        const overdueStudents = await prisma.student.findMany({
          where: { id: { in: overdueStudentIds } },
          select: { id: true, firstName: true, lastName: true },
        });
        const overdueNameById = new Map(overdueStudents.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));

        for (const installment of overdue) {
          const lateDays = Math.max(1, Math.floor((now.getTime() - installment.dueDate.getTime()) / 86_400_000));
          const who = overdueNameById.get(installment.studentId) ?? "Öğrenci";
          const amountLabel = `${Number(installment.amount).toLocaleString("tr-TR")} ₺`;

          await notifyOnce({
            institutionId: institution.id,
            recipients: adminList,
            eventType: "payment.overdue",
            title: `${who} ödemesi gecikti`,
            body: `${installment.title} · ${amountLabel} · ${lateDays} gün gecikme`,
            href: "/payments/principal",
            urgent: lateDays >= 15,
            withinHours: DEDUPE_HOURS,
          });

          await notifyOnce({
            institutionId: institution.id,
            recipients: await parentsOf(installment.studentId),
            eventType: "payment.overdue",
            title: "Vadesi geçmiş ödemeniz var",
            body: `${installment.title} · ${amountLabel} · ${lateDays} gün gecikme`,
            href: "/payments/parent",
            urgent: lateDays >= 15,
            withinHours: DEDUPE_HOURS,
          });
          overdueWarnings += 1;
        }
      } catch (institutionError) {
        logger.error("activity_digest_institution_failed", {
          institutionId: institution.id,
          error: institutionError instanceof Error ? institutionError.message : String(institutionError),
        });
      }
    }

    return NextResponse.json({ ok: true, enrollmentWarnings, overdueWarnings, institutions: institutions.length });
  } catch (error) {
    return apiFailure("activity_digest_failed", error);
  }
}

export const GET = withApiLogging("GET /api/cron/activity-digest", handleGet);
