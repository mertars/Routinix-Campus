import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeAttendanceRate } from "@/lib/server/report-card/analyzer";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";

// GET /api/parent/me — oturum açmış Veli'nin kendisi + bağlı öğrencilerinin
// özet performansı. Kimlik URL'den/body'den DEĞİL, httpOnly oturum
// cookie'sinden (imzalı JWT) gelir. Öğrenci verisi BİLEREK genel amaçlı
// /api/students/[id] üzerinden değil, doğrudan burada — session'daki
// parentId'ye bağlı ParentStudent ilişkisiyle sınırlı olarak — hesaplanır;
// böylece bir veli, URL'deki id'yi değiştirerek başka bir öğrencinin
// verisine erişemez.
async function handleGet() {
  let session;
  try {
    session = await requireSession();
    requireRole(session, "parent");
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    throw error;
  }

  const parent = await prisma.parent.findUnique({
    where: { id: session.sub },
    include: { students: { include: { student: { include: { branch: true } } } } },
  });
  if (!parent) {
    return NextResponse.json({ error: "Veli kaydı bulunamadı." }, { status: 404 });
  }

  const students = await Promise.all(
    parent.students.map(async ({ student }) => {
      const [attendanceRecords, netResults] = await Promise.all([
        prisma.attendanceRecord.findMany({ where: { studentId: student.id }, select: { status: true } }),
        prisma.examNetResult.findMany({ where: { studentId: student.id }, orderBy: { examId: "desc" } }),
      ]);
      const latestExamId = netResults[0]?.examId ?? null;
      const actualNet = latestExamId
        ? Math.round(netResults.filter((r) => r.examId === latestExamId).reduce((sum, r) => sum + r.net, 0) * 100) / 100
        : null;

      return {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        branchName: student.branch.name,
        grade: student.branch.grade,
        targetNet: student.targetNet,
        actualNet,
        attendanceRate: computeAttendanceRate(attendanceRecords),
      };
    })
  );

  return NextResponse.json({
    id: parent.id,
    name: `${parent.firstName} ${parent.lastName}`.trim(),
    students,
  });
}

export const GET = withApiLogging("GET /api/parent/me", handleGet);
