import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/videos/assignment-history — kullanıcı talebi: "video geçmişi
// paneli de lazım, kime önceden ne atıldı görebilmeli". Kurumun TÜM
// VideoAssignment kayıtlarını (video + öğrenci + izlendi mi bilgisiyle)
// en yeniden eskiye döner — video-assign-modal.tsx'in aksine burada tek
// bir videoya değil, TÜM geçmişe bakılıyor (bkz. video-history-modal.tsx).
async function handleGet(_request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const assignments = await prisma.videoAssignment.findMany({
      where: { video: { institutionId: session.institutionId } },
      select: {
        id: true,
        assignedAt: true,
        watchedAt: true,
        video: { select: { id: true, title: true, subject: true, topic: true, grade: true } },
        student: { select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } },
      },
      orderBy: { assignedAt: "desc" },
    });

    const history = assignments.map((a) => ({
      id: a.id,
      assignedAt: a.assignedAt,
      watchedAt: a.watchedAt,
      videoId: a.video.id,
      videoTitle: a.video.title,
      videoSubject: a.video.subject,
      videoTopic: a.video.topic,
      videoGrade: a.video.grade,
      studentId: a.student.id,
      studentName: `${a.student.firstName} ${a.student.lastName}`,
      branchName: a.student.branch?.name ?? "",
    }));

    return NextResponse.json({ history });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_assignment_history_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Geçmiş yüklenemedi." }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/videos/assignment-history", handleGet);
