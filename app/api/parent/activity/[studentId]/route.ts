import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/parent/activity/[studentId] — çocuğa ATANAN işler ve randevular.
//
// ⚠️ NEDEN VAR (2026-09-15 denetimi): veliye üç konuda bildirim gidiyordu
// ama veli panelinde bunların karşılığı YOKTU — bildirime tıklayan veli
// hiçbir şey bulamıyordu:
//   * "etüt talebi onaylandı"     → veli panelinde etüt ekranı yok
//   * "yeni video atandı"          → video ekranı yok
//   * "yeni kazanım görevi"        → kazanım görevi ekranı yok
// Bildirim gönderip gidecek yer vermemek, bildirim sistemine olan güveni
// bitirir; bu uç o üçünü tek yerde toplar.
//
// Üç sorgu BİRBİRİNDEN BAĞIMSIZ — tek Promise.all (ardışık yazmak her biri
// için tam bir ağ turu eklerdi).
async function handleGet(_request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");
    await assertParentOwnsStudent(session.sub, params.studentId);

    const [appointments, tasks, videos] = await Promise.all([
      prisma.appointmentRequest.findMany({
        where: { studentId: params.studentId },
        select: {
          id: true,
          day: true,
          slot: true,
          topic: true,
          status: true,
          requestedAt: true,
          teacher: { select: { firstName: true, lastName: true, subject: true } },
        },
        orderBy: { requestedAt: "desc" },
        take: 15,
      }),
      prisma.remediationTask.findMany({
        where: { studentId: params.studentId },
        select: { id: true, topic: true, taskDescription: true, assignedAt: true },
        orderBy: { assignedAt: "desc" },
        take: 15,
      }),
      prisma.videoAssignment.findMany({
        where: { studentId: params.studentId },
        select: {
          id: true,
          watchedAt: true,
          assignedAt: true,
          video: { select: { title: true, subject: true } },
        },
        orderBy: { assignedAt: "desc" },
        take: 15,
      }),
    ]);

    return NextResponse.json({
      appointments: appointments.map((a) => ({
        id: a.id,
        day: a.day,
        slot: a.slot,
        topic: a.topic,
        status: a.status,
        requestedAt: a.requestedAt.toISOString(),
        teacherName: `${a.teacher.firstName} ${a.teacher.lastName}`,
        subject: a.teacher.subject,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        topic: t.topic,
        description: t.taskDescription,
        assignedAt: t.assignedAt.toISOString(),
      })),
      videos: videos.map((v) => ({
        id: v.id,
        title: v.video.title,
        subject: v.video.subject,
        assignedAt: v.assignedAt.toISOString(),
        watchedAt: v.watchedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("parent_activity_failed", error);
  }
}

export const GET = withApiLogging("GET /api/parent/activity/[studentId]", handleGet);
