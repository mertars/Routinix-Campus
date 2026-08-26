import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSmsProviderStatus } from "@/lib/server/sms/provider-factory";
import { withApiLogging } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/health — izleme araçlarının (uptime monitör, yük dengeleyici,
// deploy sonrası smoke test) tek bakışta baktığı uçtan uca durum. Kimlik
// doğrulaması İSTEMEDEN çalışır (standart monitoring pratiği) — SMS
// sağlayıcı durumu sadece "gerekli ortam değişkenleri tanımlı mı" der,
// gerçek bir SMS göndermez (bkz. getSmsProviderStatus) ve gizli değerleri
// ASLA döndürmez, sadece hangi değişkenin eksik olduğunu söyler.
async function handleGet() {
  const startedAt = Date.now();
  let database: { status: "connected" | "disconnected"; latencyMs?: number; error?: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { status: "connected", latencyMs: Date.now() - startedAt };
  } catch (error) {
    database = { status: "disconnected", error: error instanceof Error ? error.message : "Bilinmeyen hata" };
  }

  const sms = getSmsProviderStatus();
  const overallOk = database.status === "connected" && sms.configured;

  return NextResponse.json(
    { status: overallOk ? "ok" : "degraded", database, sms },
    { status: overallOk ? 200 : 503 }
  );
}

export const GET = withApiLogging("GET /api/health", handleGet);
