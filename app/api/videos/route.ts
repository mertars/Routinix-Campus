import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { r2PublicUrl } from "@/lib/server/r2";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/videos — kurumun video kütüphanesi (yönetici VE öğretmen
// görebilir, sadece yönetici ekleyebilir — bkz. POST). Öğrenci BURAYA
// değil, /api/videos/assigned'a (SADECE kendine atanmışlar) erişir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "teacher");

    const videos = await prisma.video.findMany({
      where: { institutionId: session.institutionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true, grade: true, subject: true, topic: true, r2Key: true, durationSeconds: true, createdAt: true },
    });

    return NextResponse.json({ videos: videos.map((v) => ({ ...v, url: r2PublicUrl(v.r2Key) })) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/videos — { title, description?, grade, subject, topic, r2Key,
// durationSeconds? } — tarayıcı R2'ye YÜKLEMEYİ BİTİRDİKTEN SONRA çağırır
// (bkz. /api/videos/presign), sadece metadata + nesne anahtarını kaydeder.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const grade = Number(body?.grade);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const r2Key = typeof body?.r2Key === "string" ? body.r2Key.trim() : "";
    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;
    const durationSeconds = Number.isFinite(Number(body?.durationSeconds)) ? Math.round(Number(body.durationSeconds)) : null;

    if (!title || !subject || !topic || !r2Key || !Number.isInteger(grade) || grade < 1 || grade > 12) {
      return NextResponse.json({ error: "title, grade (1-12), subject, topic ve r2Key zorunludur." }, { status: 400 });
    }
    // r2Key'in GERÇEKTEN bu kuruma ait bir presign isteğinden geldiğini
    // doğrular — başka bir kurumun anahtarını kaydetmeye çalışmayı engeller.
    if (!r2Key.startsWith(`videos/${session.institutionId}/`)) {
      return NextResponse.json({ error: "Geçersiz r2Key." }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: { institutionId: session.institutionId, title, description, grade, subject, topic, r2Key, durationSeconds, createdById: session.sub },
    });

    return NextResponse.json({ video: { ...video, url: r2PublicUrl(video.r2Key) } });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Video kaydedilemedi." }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/videos", handleGet);
export const POST = withApiLogging("POST /api/videos", handlePost);
