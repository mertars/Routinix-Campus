import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

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
        lastPositionSeconds: true,
        video: {
          select: { id: true, title: true, description: true, grade: true, subject: true, topic: true, youtubeId: true, status: true, durationSeconds: true },
        },
      },
    });

    return NextResponse.json({
      assignments: assignments.map((a) => ({
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        watchedAt: a.watchedAt,
        lastPositionSeconds: a.lastPositionSeconds,
        ...a.video,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("video_assigned_list_failed", error);
  }
}

export const GET = withApiLogging("GET /api/videos/assigned", handleGet);
