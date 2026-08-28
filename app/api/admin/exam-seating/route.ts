import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { assignSeats, type SeatBranchInput } from "@/lib/server/seating/assign-seats";
import { isValidClassroomLayout } from "@/lib/seating/types";

export const dynamic = "force-dynamic";

// POST /api/admin/exam-seating — GERÇEK bir sınav + GERÇEK bir sınıf (kroki)
// + seçilen şubelerin GERÇEK (aktif) öğrenci rosterinden kelebek oturma
// planı üretir ve kalıcı olarak kaydeder (ExamSeatAssignment). Öğrenci/
// öğretmen paneli aynı kaydı GET /api/exam-seating ile okur — o sözleşme
// (examName/examDate/hall/seatNumber/rowNum/colNum) HİÇ DEĞİŞMEDİ.
//
// V1 kapsamı: tek çalıştırma = tek sınıf. Aynı sınav büyükse admin bu ucu
// sınıf başına birkaç kez çalıştırır; bu yüzden eski atamaları silme
// SADECE (examId, classroomId) kapsamında yapılır — başka bir sınıfa daha
// önce yapılmış atamalara dokunmaz. @@unique([examId, studentId]) bir
// öğrencinin aynı sınavda iki sınıfa birden oturtulmasını veritabanı
// seviyesinde zaten engeller; burada bunu önceden tespit edip admin'e
// açıkça raporluyoruz (sessiz bir 500 hatası yerine).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { examId, classroomId, branchIds } = body as { examId?: string; classroomId?: string; branchIds?: string[] };
    if (!examId?.trim() || !classroomId?.trim() || !Array.isArray(branchIds) || branchIds.length < 2) {
      return NextResponse.json({ error: "examId, classroomId ve en az 2 branchId zorunludur." }, { status: 400 });
    }

    const [exam, classroom] = await Promise.all([
      prisma.exam.findUnique({ where: { id: examId } }),
      prisma.classroom.findUnique({ where: { id: classroomId } }),
    ]);
    if (!exam || exam.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });
    }
    if (!classroom || classroom.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Sınıf bulunamadı." }, { status: 404 });
    }
    const layout = classroom.layout as unknown;
    if (!isValidClassroomLayout(layout) || layout.desks.length === 0) {
      return NextResponse.json({ error: "Bu sınıfın krokisi henüz oluşturulmamış." }, { status: 400 });
    }

    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIds }, institutionId: session.institutionId },
      include: {
        students: {
          where: { isActive: true },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        },
      },
    });
    // Sıralamayı branchIds'in verildiği sırayla koru (kelebek algoritması sıraya duyarlı).
    const orderedBranches = branchIds.map((id) => branches.find((b) => b.id === id)).filter((b): b is (typeof branches)[number] => !!b);
    if (orderedBranches.length < 2) {
      return NextResponse.json({ error: "Seçilen şubelerin en az 2 tanesi bu kurumda bulunmalı." }, { status: 400 });
    }

    const candidateIds = orderedBranches.flatMap((b) => b.students.map((s) => s.id));
    const existingForExam = await prisma.examSeatAssignment.findMany({
      where: { examId, studentId: { in: candidateIds } },
      select: { studentId: true, classroomId: true },
    });
    // Bu sınavda BAŞKA bir sınıfa (ya da eski hall-serbest-metin döneminden
    // kalma, classroomId'siz bir kayda) zaten oturtulmuş öğrenciler bu
    // çalıştırmadan HARİÇ tutulur — sadece bu sınıfa ait önceki kayıtlar
    // (varsa) sıfırlanıp yeniden yazılır.
    const alreadySeatedElsewhereIds = new Set(existingForExam.filter((a) => a.classroomId !== classroomId).map((a) => a.studentId));

    const seatInput: SeatBranchInput[] = orderedBranches.map((b) => ({
      branchId: b.id,
      branchName: b.name,
      students: b.students
        .filter((s) => !alreadySeatedElsewhereIds.has(s.id))
        .map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` })),
    }));
    const totalCandidates = seatInput.reduce((sum, b) => sum + b.students.length, 0);
    if (totalCandidates === 0) {
      return NextResponse.json(
        { error: "Seçilen şubelerde oturtulacak öğrenci yok (hepsi bu sınavda başka bir sınıfa atanmış olabilir)." },
        { status: 400 }
      );
    }

    const result = assignSeats(layout.desks, seatInput);

    await prisma.$transaction([
      prisma.examSeatAssignment.deleteMany({ where: { examId, classroomId } }),
      prisma.examSeatAssignment.createMany({
        data: result.assignments.map((a) => ({
          examId,
          studentId: a.studentId,
          classroomId,
          deskId: a.deskId,
          hall: classroom.name,
          seatNumber: a.seatNumber,
          rowNum: a.rowNum,
          colNum: a.colNum,
        })),
      }),
    ]);

    return NextResponse.json(
      {
        exam,
        classroom: { id: classroom.id, name: classroom.name },
        seats: result.assignments.map((a) => ({
          seatNumber: a.seatNumber,
          studentName: a.studentName,
          branchName: a.branchName,
          branchId: a.branchId,
        })),
        violationCount: result.violations.length,
        unseated: result.unseated,
        alreadySeatedElsewhereCount: alreadySeatedElsewhereIds.size,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_exam_seating_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/exam-seating", handlePost);
