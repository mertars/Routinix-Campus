import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getEnv } from "@/lib/server/env";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/activity-prune — Vercel Cron GÜNLÜK çağırır (bkz. vercel.json).
//
// ⚠️ NEDEN VAR (Mert, 2026-09-17: "kayıtlar 3 aylık olsun"): ActivityLog
// her yazma isteğini tuttuğu için sınırsız büyür. 90 günden eskisi silinir.
//
// Saklama süresini kısaltmak sadece maliyet değil, KVKK meselesidir de:
// "ne kadar tutuyorsun" sorusunun net ve savunulabilir bir cevabı olmalı.
//
// ⚠️ Silme, bulunan satırların ID'leriyle ve PARÇA PARÇA yapılır. Tek bir
// dev deleteMany, 90 günlük birikimde uzun bir kilit ve zaman aşımı
// demekti; ayrıca id ile daraltmak toplu-yazma korumasının (bkz.
// lib/server/db-guard.ts) istediği sahiplik anahtarını da sağlar.
const RETENTION_DAYS = 90;
const BATCH = 5_000;
const MAX_BATCHES = 10;

async function handleGet(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    let deleted = 0;
    for (let i = 0; i < MAX_BATCHES; i++) {
      const old = await prisma.activityLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH,
      });
      if (old.length === 0) break;
      const res = await prisma.activityLog.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
      deleted += res.count;
      if (old.length < BATCH) break;
    }
    logger.info("activity_prune_done", { deleted, retentionDays: RETENTION_DAYS });
    return NextResponse.json({ ok: true, deleted, retentionDays: RETENTION_DAYS });
  } catch (error) {
    return apiFailure("activity_prune_failed", error);
  }
}

export const GET = withApiLogging("GET /api/cron/activity-prune", handleGet);
