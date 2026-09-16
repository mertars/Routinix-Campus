import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

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

    const assignment = await prisma.videoAssignment.findUnique({
      where: { id: params.assignmentId },
      select: { studentId: true, watchedSeconds: true, video: { select: { id: true, durationSeconds: true } } },
    });
    if (!assignment || assignment.studentId !== session.sub) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const positionSeconds = Number(body?.positionSeconds);
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
      return NextResponse.json({ error: "positionSeconds zorunludur." }, { status: 400 });
    }
    const position = Math.round(positionSeconds);

    // ⚠️ İKİ AYRI ALAN (Mert: "ne kadar izlendi o işlenmeli"):
    //   lastPositionSeconds → "kaldığı yer", geri sarınca KÜÇÜLÜR
    //   watchedSeconds      → "en ileri gidilen nokta", yalnızca BÜYÜR
    // İkincisi olmadan "ne kadar izledi" sorusu dürüstçe cevaplanamaz:
    // öğrenci videoyu başa sarınca ilerleme sıfırlanmış görünürdü.
    await prisma.videoAssignment.update({
      where: { id: params.assignmentId },
      data: {
        lastPositionSeconds: position,
        watchedSeconds: Math.max(assignment.watchedSeconds ?? 0, position),
      },
    });

    // Süre bir kere öğrenilir — yüzde hesabı buna dayanır. Oynatıcı zaten
    // biliyor (bkz. youtube-player.tsx > getDuration), ayrı bir YouTube API
    // çağrısı gerekmez. İlk oynatmada /watched ucu da yazıyor ama öğrenci
    // videoyu hiç bitirmeden bırakırsa oradan hiç geçmeyebilir.
    const durationSeconds = Number(body?.durationSeconds);
    if (assignment.video.durationSeconds === null && Number.isFinite(durationSeconds) && durationSeconds > 0) {
      await prisma.video.update({ where: { id: assignment.video.id }, data: { durationSeconds: Math.round(durationSeconds) } });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("video_progress_update_failed", error);
  }
}

export const POST = withApiLogging("POST /api/videos/assigned/[assignmentId]/progress", handlePost);
