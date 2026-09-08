import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getEnv } from "@/lib/server/env";
import { withApiLogging, logger } from "@/lib/logger";
import { buildDigest, isWorthSending, renderDigestText } from "@/lib/server/payments/daily-digest";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/cron/payment-digest — Vercel Cron GÜNLÜK çağırır (bkz.
// vercel.json). Ödeme modülünü kullanan her kurumun TAM YETKİLİ
// yöneticilerine günlük özeti loglar.
//
// ⚠️ ŞU AN SMS/E-POSTA GÖNDERMEZ. Sebep bilinçli: özet müdüre gider ve
// SMS kontörü VELİ hatırlatmaları için ayrılmış bir bütçedir — müdür
// bildirimi o bütçeyi sessizce tüketirse asıl iş (tahsilat hatırlatması)
// kontörsüz kalır. Kanal (kurum e-postası / panel bildirimi) ayrı olarak
// eklenene kadar özet yalnızca loglanır; panelin üstündeki uyarı şeridi
// (DigestBanner) aynı veriyi zaten gösteriyor.
//
// Bir kurumun hatası diğerlerini DURDURMAZ.
async function handleGet(request: NextRequest) {
  const cronSecret = getEnv().CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
    }
  }

  try {
    // Ödeme modülünü GERÇEKTEN kullanan kurumlar: en az bir kasa/banka
    // hesabı tanımlamış olanlar. Aksi halde hiç kurulmamış kurumlar için
    // her sabah boş özet hesaplanırdı.
    const institutions = await prisma.institution.findMany({
      where: { paymentAccounts: { some: {} } },
      select: { id: true, name: true },
    });

    const results: { institutionId: string; sent: boolean; alerts: number; error?: string }[] = [];

    for (const institution of institutions) {
      try {
        const digest = await buildDigest(institution.id, institution.name);
        const worth = isWorthSending(digest);
        if (worth) {
          logger.info("payment_digest", {
            institutionId: institution.id,
            alerts: digest.alerts.length,
            text: renderDigestText(digest),
          });
        }
        results.push({ institutionId: institution.id, sent: worth, alerts: digest.alerts.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error("payment_digest_institution_failed", { institutionId: institution.id, error: message });
        results.push({ institutionId: institution.id, sent: false, alerts: 0, error: message });
      }
    }

    return NextResponse.json({ processed: institutions.length, results });
  } catch (error) {
    return apiFailure("payment_digest_cron_failed", error);
  }
}

export const GET = withApiLogging("GET /api/cron/payment-digest", handleGet);
