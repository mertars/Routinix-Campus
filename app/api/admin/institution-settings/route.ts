import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/institution-settings — kurumun genel bayraklarını döner.
// Kayıt yoksa (henüz hiç ayarlanmamış) şemadaki varsayılan (isEtutAdminManaged:
// true) döner — öğretmen/öğrenci panelleri de (bireysel etüt butonlarını
// gizlemek için) bu ucu okuduğundan, herhangi bir oturum GET yapabilir
// (bkz. /api/admin/etut-settings'teki AYNI desen).
async function handleGet() {
  try {
    const session = await requireSession();
    const settings = await prisma.institutionSettings.findUnique({ where: { institutionId: session.institutionId } });
    return NextResponse.json({ isEtutAdminManaged: settings?.isEtutAdminManaged ?? true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("institution_settings_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/admin/institution-settings — { isEtutAdminManaged } — SADECE yönetici.
async function handlePut(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const isEtutAdminManaged = (body as { isEtutAdminManaged?: unknown }).isEtutAdminManaged;
    if (typeof isEtutAdminManaged !== "boolean") {
      return NextResponse.json({ error: "isEtutAdminManaged boolean olmalı." }, { status: 400 });
    }

    const settings = await prisma.institutionSettings.upsert({
      where: { institutionId: session.institutionId },
      update: { isEtutAdminManaged },
      create: { institutionId: session.institutionId, isEtutAdminManaged },
    });

    return NextResponse.json({ isEtutAdminManaged: settings.isEtutAdminManaged });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("institution_settings_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/institution-settings", handleGet);
export const PUT = withApiLogging("PUT /api/admin/institution-settings", handlePut);
