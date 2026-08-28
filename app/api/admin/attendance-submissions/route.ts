import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/attendance-submissions?days=14 — öğretmenlerin "yoklamayı
// gönderdi" olaylarının (bkz. AttendanceSubmission — POST /api/attendance
// her sınıf-geneli gönderimde bunu da yazar) en yeniden eskiye akışı.
// Yönetici panelindeki "canlı takip" — kim, hangi şube için, ne zaman
// yoklama girdi — bu ucun tek amacı.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const daysParam = Number(request.nextUrl.searchParams.get("days"));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 14;
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const submissions = await prisma.attendanceSubmission.findMany({
      where: { branch: { institutionId: session.institutionId }, createdAt: { gte: since } },
      select: {
        id: true,
        date: true,
        recordCount: true,
        createdAt: true,
        teacher: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        date: s.date,
        recordCount: s.recordCount,
        createdAt: s.createdAt,
        teacherName: `${s.teacher.firstName} ${s.teacher.lastName}`,
        branchName: s.branch.name,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_attendance_submissions_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/attendance-submissions", handleGet);
