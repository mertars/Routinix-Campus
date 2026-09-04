import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/videos/assigned/[assignmentId]/progress — { positionSeconds }.
// "Kaldığı yerden devam" — YoutubePlayer oynatırken periyodik (~10sn'de
// bir) ve duraklat/bitir anında çağırır (bkz. video-player.tsx >
// onProgress). Sessizce başarısız olsa bile öğrencinin izlemesini
// ENGELLEMEMESİ için istemci tarafında bilerek best-effort (bkz.
// videos.tsx > reportProgress).
async function handlePost(request: Request, { params }: { params: { assignmentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignment = await prisma.videoAssignment.findUnique({ where: { id: params.assignmentId }, select: { studentId: true } });
    if (!assignment || assignment.studentId !== session.sub) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const positionSeconds = Number(body?.positionSeconds);
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
      return NextResponse.json({ error: "positionSeconds zorunludur." }, { status: 400 });
    }

    await prisma.videoAssignment.update({ where: { id: params.assignmentId }, data: { lastPositionSeconds: Math.round(positionSeconds) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_progress_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/videos/assigned/[assignmentId]/progress", handlePost);
