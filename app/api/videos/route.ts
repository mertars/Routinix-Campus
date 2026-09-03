import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
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
      select: { id: true, title: true, description: true, grade: true, subject: true, topic: true, youtubeId: true, createdAt: true },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/videos — { title, description?, grade, subject, topic,
// youtubeId } — yönetici YouTube linkini yapıştırıp video ID'sini
// çözdükten SONRA (bkz. lib/client/youtube.ts > extractYoutubeId) çağırır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const grade = Number(body?.grade);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const youtubeId = typeof body?.youtubeId === "string" ? body.youtubeId.trim() : "";
    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : null;

    if (!title || !subject || !topic || !Number.isInteger(grade) || grade < 1 || grade > 12) {
      return NextResponse.json({ error: "title, grade (1-12), subject ve topic zorunludur." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId)) {
      return NextResponse.json({ error: "Geçerli bir YouTube video ID'si gerekli." }, { status: 400 });
    }

    const video = await prisma.video.create({
      data: { institutionId: session.institutionId, title, description, grade, subject, topic, youtubeId, createdById: session.sub },
    });

    return NextResponse.json({ video });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Video kaydedilemedi." }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/videos", handleGet);
export const POST = withApiLogging("POST /api/videos", handlePost);
