import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRate } from "@/lib/server/report-card/analyzer";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/students/[id] — useStudentScope'un tek gerçek veri kaynağı.
async function handleGet(_request: Request, { params }: { params: { id: string } }) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: { branch: true },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const [attendanceRecords, netResults] = await Promise.all([
      prisma.attendanceRecord.findMany({ where: { studentId: student.id }, select: { status: true } }),
      prisma.examNetResult.findMany({ where: { studentId: student.id }, include: { exam: true }, orderBy: { exam: { examDate: "desc" } } }),
    ]);

    // "Güncel Net": en son denemedeki tüm branşların net toplamı.
    const latestExamId = netResults[0]?.examId ?? null;
    const actualNet = latestExamId
      ? Math.round(netResults.filter((r) => r.examId === latestExamId).reduce((sum, r) => sum + r.net, 0) * 100) / 100
      : null;

    return NextResponse.json({
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      studentNumber: student.studentNumber,
      branchId: student.branchId,
      branchName: student.branch.name,
      grade: student.branch.grade,
      targetNet: student.targetNet,
      weeklyStudyHours: student.weeklyStudyHours,
      actualNet,
      attendanceRate: computeAttendanceRate(attendanceRecords),
    });
  } catch (error) {
    logger.error("student_detail_failed", { studentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/students/[id]", handleGet);
