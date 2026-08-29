import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getAbsenceSummary } from "@/lib/server/attendance/absence-summary";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/attendance-history?studentId=X — bir öğrencinin TÜM
// devamsızlık geçmişi (artık ders bazlı, bkz. Part 4 şema notu), kronolojik
// (en yeni önce) + "ekranın üstünde" gösterilecek İKİ ayrı özet: Günlük
// Devamsızlık (kaç farklı gün) ve Ders Devamsızlığı (kaç ayrı ders saati) —
// bkz. lib/server/attendance/absence-summary.ts.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { institutionId: true, firstName: true, lastName: true, branch: { select: { name: true } } },
    });
    if (!student || student.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    const [records, summary] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { studentId },
        select: { date: true, slot: true, subject: true, status: true },
        orderBy: [{ date: "desc" }, { slot: "asc" }],
      }),
      getAbsenceSummary(studentId),
    ]);

    return NextResponse.json({
      student: { firstName: student.firstName, lastName: student.lastName, branchName: student.branch.name },
      summary,
      records,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_attendance_history_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/attendance-history", handleGet);
