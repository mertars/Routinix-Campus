import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { r2PublicUrl } from "@/lib/server/r2";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/videos/assigned — öğrencinin KENDİSİNE atanmış videoları döner
// (bkz. /api/videos'un AKSİNE — yönetici/öğretmen kütüphanenin TAMAMINI
// görür, öğrenci SADECE kendine atananları).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignments = await prisma.videoAssignment.findMany({
      where: { studentId: session.sub },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        assignedAt: true,
        watchedAt: true,
        video: { select: { id: true, title: true, description: true, grade: true, subject: true, topic: true, r2Key: true, durationSeconds: true } },
      },
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        watchedAt: a.watchedAt,
        ...a.video,
        url: r2PublicUrl(a.video.r2Key),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_assigned_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/videos/assigned", handleGet);
