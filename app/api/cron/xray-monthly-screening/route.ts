import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { pickRandomTestFromPool, capSelection } from "@/lib/server/xray/practice-pool";
import { resolveTargetStudentIds } from "@/lib/server/xray/assignment-target";
import { MONTHLY_SCREENING_QUESTION_COUNT } from "@/lib/server/xray/monthly-screening";
import { getEnv } from "@/lib/server/env";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/xray-monthly-screening — Vercel Cron GÜNLÜK çağırır (bkz.
// vercel.json). ENABLED VE nextRunAt <= now olan her (kurum, sınıf
// seviyesi) satırı için O SEVİYEDEKİ TÜM öğrencilere Test 1 havuzundan
// (bkz. capSelection) en fazla MONTHLY_SCREENING_QUESTION_COUNT sorulu
// bir "unutma riski" tarama testi atar, sonra nextRunAt'i intervalDays
// kadar ileri alır. Kimlik doğrulama: Vercel, CRON_SECRET ortam değişkeni
// tanımlıysa isteğe otomatik "Authorization: Bearer <CRON_SECRET>"
// ekler — üretimde bu değer HER ZAMAN tanımlı olmak ZORUNDA (bkz.
// lib/server/env.ts fail-fast kuralı), dev'de tanımsızsa kontrol atlanır
// (yerel test kolaylığı için).
async function handleGet(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  try {
    const now = new Date();
    const dueConfigs = await prisma.xrayMonthlyScreeningConfig.findMany({ where: { enabled: true, nextRunAt: { lte: now } } });

    const results: { grade: number; institutionId: string; assigned: number; error?: string }[] = [];

    for (const config of dueConfigs) {
      try {
        const pool = await prisma.xrayPracticeQuestion.findMany({
          where: { subject: config.subject, subtopicId: config.subtopicId },
          select: { id: true, kazanimId: true, order: true, testId: true },
        });
        const studentIds = pool.length > 0 ? await resolveTargetStudentIds(config.institutionId, { type: "grade", grade: config.grade }) : [];

        let assigned = 0;
        for (const studentId of studentIds) {
          const selection = capSelection(pickRandomTestFromPool(pool), MONTHLY_SCREENING_QUESTION_COUNT);
          await prisma.xrayPracticeAttempt.create({
            data: {
              studentId,
              subject: config.subject,
              subtopicId: config.subtopicId,
              assignedById: config.configuredById,
              questions: { create: selection.map((s) => ({ questionId: s.id, order: s.order })) },
            },
          });
          assigned++;
        }

        await prisma.xrayMonthlyScreeningConfig.update({
          where: { id: config.id },
          data: { nextRunAt: new Date(now.getTime() + config.intervalDays * 24 * 60 * 60 * 1000) },
        });

        results.push({ grade: config.grade, institutionId: config.institutionId, assigned });
      } catch (error) {
        logger.error("xray_monthly_screening_run_failed", {
          configId: config.id,
          error: error instanceof Error ? error.message : String(error),
        });
        results.push({ grade: config.grade, institutionId: config.institutionId, assigned: 0, error: "failed" });
      }
    }

    return NextResponse.json({ processed: dueConfigs.length, results });
  } catch (error) {
    logger.error("xray_monthly_screening_cron_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/cron/xray-monthly-screening", handleGet);
