import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/exam-seating?studentId=X — öğrencinin EN SON kelebek sınav
// oturma atamasını döner (Dijital Sınav Giriş Kartı).
async function handleGet(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });

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
    logger.error("exam_seating_lookup_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exam-seating", handleGet);
