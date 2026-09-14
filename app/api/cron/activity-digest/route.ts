import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getEnv } from "@/lib/server/env";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { notifyManyOnce, admins, type NotifyRecipient } from "@/lib/server/notifications/activity";

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
// ⚠️ SORGU BÜTÇESİ — bu dosyanın en önemli kısıtı.
// İlk sürüm taksit başına ayrı sorgu atıyordu; Arslan Dershaneleri'nin
// GERÇEK verisiyle ölçüldü: 75 gecikmiş taksit → ~375 sıralı gidiş-dönüş →
// **59 saniye** (Vercel'in 60 sn sınırında zaman aşımı demek). Şimdi kurum
// başına SABİT sorgu: 2 liste + 1 veli bağı + notifyManyOnce'ın 2 sorgusu.
// Döngü İÇİNDE sorgu ekleme — kalem sayısı arttıkça süre patlar.
//
// ⚠️ Bir kurumdaki hata diğerlerini DURDURMAZ (payment-reminders'daki
// AYNI gerekçe) — her kurum kendi try bloğunda.

/** Kayıt bitişine bu kadar gün kalınca uyar. */
const ENROLLMENT_WARN_DAYS = 30;
/** Aynı uyarı bu pencere içinde tekrar yazılmaz. */
const DEDUPE_HOURS = 20 * 24;
/** Tek çalıştırmada bir kurumdan işlenecek azami gecikmiş taksit. */
const MAX_OVERDUE_PER_RUN = 300;

async function handleGet(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  try {
    const startedAt = Date.now();
    const institutions = await prisma.institution.findMany({ select: { id: true } });
    const now = new Date();
    const horizon = new Date(now.getTime() + ENROLLMENT_WARN_DAYS * 86_400_000);
    let written = 0;

    for (const institution of institutions) {
      try {
        const adminList = await admins(institution.id);
        if (adminList.length === 0) continue;

        // --- Tek seferde çekilen listeler ---
        const [expiring, overdue] = await Promise.all([
          prisma.studentEnrollment.findMany({
            where: { institutionId: institution.id, status: "ACTIVE", endDate: { gte: now, lte: horizon } },
            select: {
              endDate: true,
              academicYear: true,
              student: { select: { id: true, firstName: true, lastName: true } },
            },
          }),
          prisma.installment.findMany({
            where: {
              institutionId: institution.id,
              status: { in: ["PENDING", "PARTIALLY_PAID"] },
              dueDate: { lt: now },
            },
            select: { title: true, dueDate: true, amount: true, studentId: true },
            orderBy: { dueDate: "asc" },
            take: MAX_OVERDUE_PER_RUN,
          }),
        ]);

        // Öğrenci adları + veli bağları TEK sorguda (döngü içinde DEĞİL).
        const overdueStudentIds = [...new Set(overdue.map((i) => i.studentId))];
        const [overdueStudents, parentLinks] = await Promise.all([
          overdueStudentIds.length
            ? prisma.student.findMany({
                where: { id: { in: overdueStudentIds } },
                select: { id: true, firstName: true, lastName: true },
              })
            : Promise.resolve([] as { id: string; firstName: string; lastName: string }[]),
          overdueStudentIds.length
            ? prisma.parentStudent.findMany({
                where: { studentId: { in: overdueStudentIds } },
                select: { studentId: true, parentId: true },
              })
            : Promise.resolve([] as { studentId: string; parentId: string }[]),
        ]);
        const nameById = new Map(overdueStudents.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
        const parentsByStudent = new Map<string, string[]>();
        for (const link of parentLinks) {
          const list = parentsByStudent.get(link.studentId) ?? [];
          list.push(link.parentId);
          parentsByStudent.set(link.studentId, list);
        }

        // --- Bildirim kalemleri toplanır, TEK seferde yazılır ---
        const items: Parameters<typeof notifyManyOnce>[0] = [];

        for (const enrollment of expiring) {
          const daysLeft = Math.max(0, Math.ceil((enrollment.endDate.getTime() - now.getTime()) / 86_400_000));
          items.push({
            institutionId: institution.id,
            recipients: adminList,
            eventType: "student.enrollment_expiring",
            title: `${enrollment.student.firstName} ${enrollment.student.lastName} kaydının süresi bitmek üzere`,
            body: `${daysLeft} gün kaldı · ${enrollment.academicYear} · Bitiş ${enrollment.endDate.toLocaleDateString("tr-TR")}`,
            href: "/principal?tab=students",
            urgent: daysLeft <= 7,
          });
        }

        for (const installment of overdue) {
          const lateDays = Math.max(1, Math.floor((now.getTime() - installment.dueDate.getTime()) / 86_400_000));
          const who = nameById.get(installment.studentId) ?? "Öğrenci";
          const amountLabel = `${Number(installment.amount).toLocaleString("tr-TR")} ₺`;
          const detail = `${installment.title} · ${amountLabel} · ${lateDays} gün gecikme`;

          items.push({
            institutionId: institution.id,
            recipients: adminList,
            eventType: "payment.overdue",
            title: `${who} ödemesi gecikti`,
            body: detail,
            href: "/payments/principal",
            urgent: lateDays >= 15,
          });

          const parentIds = parentsByStudent.get(installment.studentId) ?? [];
          if (parentIds.length > 0) {
            items.push({
              institutionId: institution.id,
              recipients: parentIds.map((id): NotifyRecipient => ({ role: "PARENT", id })),
              eventType: "payment.overdue",
              title: "Vadesi geçmiş ödemeniz var",
              body: detail,
              href: "/payments/parent",
              urgent: lateDays >= 15,
            });
          }
        }

        written += await notifyManyOnce(items, DEDUPE_HOURS);
      } catch (institutionError) {
        logger.error("activity_digest_institution_failed", {
          institutionId: institution.id,
          error: institutionError instanceof Error ? institutionError.message : String(institutionError),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      written,
      institutions: institutions.length,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return apiFailure("activity_digest_failed", error);
  }
}

export const GET = withApiLogging("GET /api/cron/activity-digest", handleGet);
