import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createUploadUrl } from "@/lib/server/r2";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

// POST /api/videos/presign — { fileName, contentType } → { uploadUrl, key }.
// Tarayıcı bu imzalı URL'e DOĞRUDAN R2'ye PUT eder — R2 burada KALICI
// depolama DEĞİL, sadece "tarayıcıdan sunucuya büyük dosya geçirme"
// tamponu (bkz. lib/server/r2.ts'teki AYNI not). POST /api/videos bu
// nesneyi okuyup YouTube'a aktarır, sonra R2'den SİLER.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const fileName = typeof body?.fileName === "string" ? body.fileName : null;
    const contentType = typeof body?.contentType === "string" ? body.contentType : null;
    if (!fileName || !contentType) return NextResponse.json({ error: "fileName ve contentType zorunludur." }, { status: 400 });
    if (!ALLOWED_TYPES.includes(contentType)) return NextResponse.json({ error: "Desteklenmeyen video formatı." }, { status: 400 });

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const key = `staging/${session.institutionId}/${randomUUID()}-${safeName}`;
    const uploadUrl = await createUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_presign_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Yükleme linki oluşturulamadı." }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/videos/presign", handlePost);
