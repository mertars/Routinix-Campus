import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getTodayTrDayName, parseSlotRange, nowMinutes } from "@/lib/schedule-time";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/live-tutoring — Yönetici panelindeki "Canlı Birebir Etüt &
// Randevu" ekranının gerçek veri kaynağı. Öğrenci/öğretmen tarafının
// AppointmentRequest tablosuyla AYNI veriyi, "bugün onaylanmış" görünümüyle
// gösterir — ayrı bir mock liste değil.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const today = getTodayTrDayName();
    const minutesNow = nowMinutes();

    const approvedToday = today
      ? await prisma.appointmentRequest.findMany({
          where: { status: "APPROVED", day: today, teacher: { institutionId: session.institutionId } },
          include: {
            student: { select: { firstName: true, lastName: true } },
            teacher: { select: { firstName: true, lastName: true, subject: true } },
          },
        })
      : [];

    const sessions = approvedToday.map((appt) => {
      const [start, end] = parseSlotRange(appt.slot);
      const isLive = minutesNow >= start && minutesNow < end;
      const isPast = minutesNow >= end;
      return {
        id: appt.id,
        teacherName: `${appt.teacher.firstName} ${appt.teacher.lastName}`,
        subject: appt.teacher.subject,
        studentName: `${appt.student.firstName} ${appt.student.lastName}`,
        topic: appt.topic,
        startTime: appt.slot.split("-")[0],
        endTime: appt.slot.split("-")[1],
        status: isLive ? ("live" as const) : isPast ? ("completed" as const) : ("upcoming" as const),
        remainingSeconds: isLive ? Math.max(0, (end - minutesNow) * 60) : 0,
      };
    });

    const completedToday = sessions.filter((s) => s.status === "completed").length;
    const liveNow = sessions.filter((s) => s.status === "live").length;
    const durations = approvedToday.map((appt) => {
      const [start, end] = parseSlotRange(appt.slot);
      return end - start;
    });
    const avgDurationMinutes = durations.length > 0 ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0;

    const upcoming = sessions
      .filter((s) => s.status === "upcoming")
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 8);

    return NextResponse.json({
      stats: { completedToday, liveNow, avgDurationMinutes },
      liveGrid: sessions.filter((s) => s.status !== "completed"),
      upcoming,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_live_tutoring_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/live-tutoring", handleGet);
