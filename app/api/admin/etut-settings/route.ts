import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const DEFAULT_DURATION_MINUTES = 20;
const MIN_DURATION_MINUTES = 5;
const MAX_DURATION_MINUTES = 180;

// GET /api/admin/etut-settings — kurumun etüt süresini döner. Kayıt yoksa
// (henüz hiç ayarlanmamış) varsayılan 20 dk döner — 404 değil, çünkü bu
// "ayarlanmamış" durumu, öğrenci/öğretmen tarafının da güvenle okuyabileceği
// bir varsayılandır (bkz. lib/server/etut/compute-available-slots.ts çağıranları).
async function handleGet() {
  try {
    const session = await requireSession();
    const setting = await prisma.etutSetting.findUnique({ where: { institutionId: session.institutionId } });
    return NextResponse.json({ durationMinutes: setting?.durationMinutes ?? DEFAULT_DURATION_MINUTES });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("etut_settings_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/admin/etut-settings — { durationMinutes } — SADECE yönetici.
async function handlePut(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const durationMinutes = Number((body as { durationMinutes?: unknown }).durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
      return NextResponse.json({ error: `Etüt süresi ${MIN_DURATION_MINUTES}-${MAX_DURATION_MINUTES} dakika arasında olmalı.` }, { status: 400 });
    }

    const setting = await prisma.etutSetting.upsert({
      where: { institutionId: session.institutionId },
      update: { durationMinutes },
      create: { institutionId: session.institutionId, durationMinutes },
    });

    return NextResponse.json({ durationMinutes: setting.durationMinutes });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("etut_settings_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/etut-settings", handleGet);
export const PUT = withApiLogging("PUT /api/admin/etut-settings", handlePut);
