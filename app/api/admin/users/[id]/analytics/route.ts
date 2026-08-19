import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRate } from "@/lib/server/report-card/analyzer";
import { computeRisk } from "@/lib/server/risk/compute-risk";
import { computeActivityScore } from "@/lib/server/teacher-activity";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function studentAnalytics(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: { branch: true },
  });
  if (!student) return null;

  const [netResults, attendanceRecords, homeworkSubmissions, guidanceNotes] = await Promise.all([
    prisma.examNetResult.findMany({ where: { studentId }, include: { exam: true }, orderBy: { exam: { examDate: "asc" } } }),
    prisma.attendanceRecord.findMany({ where: { studentId } }),
    prisma.homeworkSubmission.findMany({ where: { studentId } }),
    prisma.guidanceNote.findMany({ where: { studentId, confidentialityLevel: { not: "CONFIDENTIAL" } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const netTrend = netResults.map((r) => ({ examName: r.exam.name, subject: r.subject, net: r.net }));
  const attendanceRate = computeAttendanceRate(attendanceRecords);
  const homeworkTotal = homeworkSubmissions.length;
  const homeworkDone = homeworkSubmissions.filter((s) => s.status === "DONE").length;
  const homeworkSuccessRate = homeworkTotal === 0 ? null : Math.round((homeworkDone / homeworkTotal) * 100);
  const { riskScore, reason: riskReason } = computeRisk({
    attendanceRate,
    homeworkSuccessRate,
    nets: netResults.map((r) => r.net),
  });

  return {
    role: "STUDENT" as const,
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    branchName: student.branch.name,
    branchId: student.branchId,
    targetNet: student.targetNet,
    weeklyStudyHours: student.weeklyStudyHours,
    netTrend,
    attendanceRate,
    homeworkSuccessRate,
    homeworkTotal,
    riskScore,
    riskReason,
    guidanceNotes: guidanceNotes.map((n) => ({ id: n.id, category: n.category, note: n.note, createdAt: n.createdAt.toISOString() })),
  };
}

async function teacherAnalytics(teacherId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: { teachingBranches: true },
  });
  if (!teacher) return null;

  // Danışmanlık (advisorBranches) TEK şubedir; bir öğretmen birden fazla
  // şubede ders verebilir — sınıf net ortalaması/branş listesi bu yüzden
  // gerçek "ders veriyor" ilişkisinden (teachingBranches) hesaplanır.
  const branchIds = teacher.teachingBranches.map((b) => b.id);

  const [classNetResults, attendanceSubmissionCount, homeworkCount, quizCount] = await Promise.all([
    branchIds.length > 0
      ? prisma.examNetResult.findMany({ where: { student: { branchId: { in: branchIds } } }, select: { net: true } })
      : Promise.resolve([]),
    prisma.attendanceSubmission.count({ where: { teacherId } }),
    prisma.homework.count({ where: { teacherId } }),
    prisma.quiz.count({ where: { teacherId } }),
  ]);

  const classAverageNet = classNetResults.length === 0 ? null : Math.round((classNetResults.reduce((sum, r) => sum + r.net, 0) / classNetResults.length) * 100) / 100;

  const activityScore = computeActivityScore({ attendanceSubmissionCount, homeworkCount, quizCount });

  return {
    role: "TEACHER" as const,
    id: teacher.id,
    firstName: teacher.firstName,
    lastName: teacher.lastName,
    subject: teacher.subject,
    branchNames: teacher.teachingBranches.map((b) => b.name),
    classAverageNet,
    attendanceSubmissionCount,
    homeworkCount,
    quizCount,
    activityScore,
  };
}

async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const role = request.nextUrl.searchParams.get("role");
    if (role !== "STUDENT" && role !== "TEACHER") {
      return NextResponse.json({ error: "role parametresi 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const result = role === "STUDENT" ? await studentAnalytics(params.id) : await teacherAnalytics(params.id);
    if (!result) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("admin_analytics_failed", { userId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/users/[id]/analytics", handleGet);
