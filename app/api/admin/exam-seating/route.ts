import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/admin/exam-seating — Kelebek Sınav Oturma Planı'nı GERÇEK
// öğrenci rosterinden üretir ve kalıcı olarak kaydeder (ExamSeatAssignment).
// Öğrenci/öğretmen paneli aynı kaydı GET /api/exam-seating ile okur.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { examName, hall, branchIds } = body as {
      examName?: string;
      examDate?: string;
      hall?: string;
      branchIds?: string[];
    };
    if (!examName?.trim() || !hall?.trim() || !Array.isArray(branchIds) || branchIds.length < 2) {
      return NextResponse.json({ error: "examName, hall ve en az 2 branchId zorunludur." }, { status: 400 });
    }

    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds }, institutionId: session.institutionId },
      include: { students: { select: { id: true, firstName: true, lastName: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] } },
    });
    // Sıralamayı branchIds'in verildiği sırayla koru (kelebek algoritması sıraya duyarlı).
    const orderedBranches = branchIds.map((id) => branches.find((b) => b.id === id)).filter((b): b is (typeof branches)[number] => !!b);

    // UI'daki "Tarih" alanı serbest metin (örn. "22 Ağustos 2026") — güvenilir
    // biçimde ayrıştırılamaz, bu yüzden Exam.examDate her zaman planın
    // OLUŞTURULDUĞU ana ("şimdi") ayarlanır; serbest metin yalnızca
    // giriş kartı/kapı listesi yazdırma önizlemesinde gösterim amaçlıdır.
    const exam = await prisma.exam.create({ data: { institutionId: session.institutionId, name: examName.trim(), examDate: new Date() } });

    const queues = orderedBranches.map((b) => [...b.students]);
    const seats: { studentId: string; studentName: string; branchName: string; branchIndex: number; seatNumber: number }[] = [];
    let seatNumber = 1;
    let remaining = queues.some((q) => q.length > 0);
    while (remaining) {
      queues.forEach((queue, index) => {
        if (queue.length > 0) {
          const student = queue.shift()!;
          seats.push({
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            branchName: orderedBranches[index].name,
            branchIndex: index,
            seatNumber: seatNumber++,
          });
        }
      });
      remaining = queues.some((q) => q.length > 0);
    }

    const COLS = 6;
    await prisma.examSeatAssignment.createMany({
      data: seats.map((seat) => ({
        examId: exam.id,
        studentId: seat.studentId,
        hall: hall.trim(),
        seatNumber: seat.seatNumber,
        rowNum: Math.floor((seat.seatNumber - 1) / COLS) + 1,
        colNum: ((seat.seatNumber - 1) % COLS) + 1,
      })),
    });

    return NextResponse.json({ exam, seats }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_exam_seating_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/exam-seating", handlePost);
