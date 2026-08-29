import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PDF'lerin (Gelişim Karnesi vb.) sol üst köşesinde gösterilecek makul bir
// dosya boyutu üst sınırı — base64 kodlamasının ~%33 şişme payı dahil
// yaklaşık 2MB'lık bir görsele denk gelir.
const MAX_LOGO_DATA_URI_LENGTH = 2_800_000;

// GET /api/admin/institution-logo — "Logoyu Güncelle" ayar kartını besler.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { logoUrl: true } });
    return NextResponse.json({ logoUrl: institution?.logoUrl ?? null });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("institution_logo_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/admin/institution-logo — { logoUrl } — dosya yükleme şimdilik
// base64 data URI olarak mock'lanıyor (bkz. components/principal/tabs/
// system-settings.tsx > LogoUploadCard, FileReader.readAsDataURL). logoUrl
// null gönderilirse logo kaldırılır (PDF üretimi otomatik olarak kurum
// baş harfi monogramına döner, bkz. components/pdf/pdf-report-card.tsx).
async function handlePut(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const logoUrl = (body as { logoUrl?: unknown }).logoUrl;
    if (logoUrl !== null && (typeof logoUrl !== "string" || !logoUrl.startsWith("data:image/"))) {
      return NextResponse.json({ error: "logoUrl, 'data:image/...' ile başlayan bir base64 görsel ya da null olmalı." }, { status: 400 });
    }
    if (typeof logoUrl === "string" && logoUrl.length > MAX_LOGO_DATA_URI_LENGTH) {
      return NextResponse.json({ error: "Logo görseli çok büyük — lütfen 2MB'dan küçük bir dosya seçin." }, { status: 400 });
    }

    await prisma.institution.update({ where: { id: session.institutionId }, data: { logoUrl } });
    return NextResponse.json({ logoUrl });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("institution_logo_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/institution-logo", handleGet);
export const PUT = withApiLogging("PUT /api/admin/institution-logo", handlePut);
