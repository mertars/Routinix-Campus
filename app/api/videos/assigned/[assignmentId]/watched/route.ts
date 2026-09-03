import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/videos/assigned/[assignmentId]/watched — öğrenci videoyu
// oynatmaya başlayınca (bkz. video-player.tsx > onPlay) çağrılır, "izlendi"
// zaman damgasını KİLİTLER (ilk izlemeden SONRA tekrar oynatılsa bile
// üzerine YAZILMAZ — @@unique zaten yok ama burada bilerek sadece watchedAt
// null İSE güncelleniyor, "en son ne zaman izledi" değil "ilk ne zaman
// izledi" anlamlı olsun diye).
async function handlePost(_request: Request, { params }: { params: { assignmentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignment = await prisma.videoAssignment.findUnique({ where: { id: params.assignmentId }, select: { studentId: true, watchedAt: true } });
    if (!assignment || assignment.studentId !== session.sub) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    if (!assignment.watchedAt) {
      await prisma.videoAssignment.update({ where: { id: params.assignmentId }, data: { watchedAt: new Date() } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_mark_watched_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/videos/assigned/[assignmentId]/watched", handlePost);
