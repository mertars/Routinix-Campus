import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getEnv } from "@/lib/server/env";
import { withApiLogging, logger } from "@/lib/logger";
import {
  collectDueSoon,
  collectOverdue,
  sendReminders,
  type SendResult,
} from "@/lib/server/payments/reminder-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/payment-reminders — Vercel Cron GÜNLÜK çağırır (bkz.
// vercel.json). isActive olan her kurum için:
//   1) vadesi daysBefore gün içinde dolacak taksitler → beforeTemplate
//   2) daysAfter günden fazla gecikmiş taksitler       → afterTemplate
//
// Hatırlatma altyapısı zaten vardı ama tetiği ELLEYDİ — müdürün her sabah
// hatırlaması gerekiyordu, yani pratikte çalışmıyordu.
//
// Kimlik doğrulama xray-monthly-screening ile AYNI: CRON_SECRET tanımlıysa
// Bearer başlığı aranır, dev'de tanımsızsa kontrol atlanır.
//
// ⚠️ Bir kurumdaki hata diğerlerini DURDURMAZ: her kurum kendi try
// bloğunda işlenir, aksi halde tek bir bozuk kayıt o günün tüm
// hatırlatmalarını iptal ederdi.
async function handleGet(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  try {
    const rules = await prisma.reminderRule.findMany({ where: { isActive: true } });
    const results: { institutionId: string; before: SendResult | null; after: SendResult | null; error?: string }[] = [];

    for (const rule of rules) {
      try {
        let before: SendResult | null = null;
        let after: SendResult | null = null;

        if (rule.daysBefore > 0) {
          const targets = await collectDueSoon(rule.institutionId, rule.daysBefore);
          before = await sendReminders(rule.institutionId, targets, rule.beforeTemplate);
        }
        if (rule.daysAfter > 0) {
          const targets = await collectOverdue(rule.institutionId, rule.daysAfter);
          after = await sendReminders(rule.institutionId, targets, rule.afterTemplate);
        }

        const sent = (before?.sent ?? 0) + (after?.sent ?? 0);
        await prisma.reminderRule.update({
          where: { id: rule.id },
          data: { lastRunAt: new Date(), lastSentCount: sent },
        });
        results.push({ institutionId: rule.institutionId, before, after });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("payment_reminder_cron_institution_failed", { institutionId: rule.institutionId, error: message });
        results.push({ institutionId: rule.institutionId, before: null, after: null, error: message });
      }
    }

    return NextResponse.json({ processed: rules.length, results });
  } catch (error) {
    logger.error("payment_reminder_cron_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/cron/payment-reminders", handleGet);
