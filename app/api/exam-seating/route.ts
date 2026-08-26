import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/exam-seating?studentId=X — öğrencinin EN SON kelebek sınav
// oturma atamasını döner (Dijital Sınav Giriş Kartı). Erişim students/[id]
// ile aynı sahiplik kuralına tabidir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, studentId);

    const assignment = await prisma.examSeatAssignment.findFirst({
      where: { studentId },
      include: { exam: true },
      orderBy: { createdAt: "desc" },
    });
    if (!assignment) return NextResponse.json({ assignment: null });

    return NextResponse.json({
      assignment: {
        examName: assignment.exam.name,
        examDate: assignment.exam.examDate,
        hall: assignment.hall,
        seatNumber: assignment.seatNumber,
        rowNum: assignment.rowNum,
        colNum: assignment.colNum,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_seating_lookup_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exam-seating", handleGet);
