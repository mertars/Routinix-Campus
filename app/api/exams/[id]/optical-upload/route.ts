import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { listStudentRosterForMatching } from "@/lib/server/admin/exam-net-results";
import { parseOpticalText, scoreOpticalAnswers, matchOpticalRow, type OpticalFormatDef } from "@/lib/server/exams/optical-import";

export const dynamic = "force-dynamic";

export type OpticalPreviewRow = {
  lineNumber: number;
  name: string | null;
  tcNo: string | null;
  studentNo: string | null;
  matchedStudentId: string | null;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  candidates: { id: string; firstName: string; lastName: string }[];
  net: number;
  correctCount: number;
  wrongQuestionNumbers: number[];
  blankQuestionNumbers: number[];
};

// POST /api/exams/[id]/optical-upload — { formatId, subject, rawText }.
// Optik .txt dosyasını (bkz. lib/server/exams/optical-import.ts) tanımlı
// bir OpticalFormat + o ders için önceden girilmiş cevap anahtarına
// (ExamQuestion.correctAnswer, bkz. answer-key route) göre ayrıştırıp
// puanlar. HİÇBİR ŞEY KAYDETMEZ — sadece önizleme döner (PDF sihirbazıyla
// AYNI felsefe: kaydetmeden önce admin eşleşmeleri gözden geçirebilsin).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const formatId = typeof body?.formatId === "string" ? body.formatId : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const rawText = typeof body?.rawText === "string" ? body.rawText : "";
    if (!formatId || !subject || !rawText.trim()) {
      return NextResponse.json({ error: "formatId, subject ve rawText zorunludur." }, { status: 400 });
    }

    const format = await prisma.opticalFormat.findUnique({ where: { id: formatId }, include: { subjectBlocks: true } });
    if (!format || format.institutionId !== session.institutionId) return NextResponse.json({ error: "Optik format bulunamadı." }, { status: 404 });

    const subjectBlock = format.subjectBlocks.find((b) => b.subject === subject);
    if (!subjectBlock) return NextResponse.json({ error: `Bu format için "${subject}" dersinin sütun aralığı tanımlı değil.` }, { status: 400 });

    const questions = await prisma.examQuestion.findMany({
      where: { examId: params.id, subject },
      select: { questionNumber: true, correctAnswer: true },
      orderBy: { questionNumber: "asc" },
    });
    if (questions.length === 0) {
      return NextResponse.json({ error: "Bu ders için önce cevap anahtarı (doğru cevaplar) girilmeli." }, { status: 400 });
    }
    if (questions.every((q) => !q.correctAnswer)) {
      return NextResponse.json({ error: "Bu dersin cevap anahtarında hiçbir soru için doğru cevap (A-E) girilmemiş." }, { status: 400 });
    }

    const formatDef: OpticalFormatDef = {
      tcNo: format.tcNoStart && format.tcNoLength ? { start: format.tcNoStart, length: format.tcNoLength } : null,
      studentNo: format.studentNoStart && format.studentNoLength ? { start: format.studentNoStart, length: format.studentNoLength } : null,
      booklet: format.bookletStart && format.bookletLength ? { start: format.bookletStart, length: format.bookletLength } : null,
      grade: format.gradeStart && format.gradeLength ? { start: format.gradeStart, length: format.gradeLength } : null,
      branch: format.branchStart && format.branchLength ? { start: format.branchStart, length: format.branchLength } : null,
      name: format.nameStart && format.nameLength ? { start: format.nameStart, length: format.nameLength } : null,
    };

    const parsedRows = parseOpticalText(rawText, formatDef, { start: subjectBlock.start, length: subjectBlock.length });
    if (parsedRows.length === 0) return NextResponse.json({ error: "Dosyada okunabilir satır bulunamadı." }, { status: 400 });

    const roster = await listStudentRosterForMatching(session.institutionId);

    const preview: OpticalPreviewRow[] = parsedRows.map((row) => {
      const match = matchOpticalRow(row, roster);
      const score = scoreOpticalAnswers(row.rawAnswers, questions);
      return {
        lineNumber: row.lineNumber,
        name: row.name,
        tcNo: row.tcNo,
        studentNo: row.studentNo,
        matchedStudentId: match.studentId,
        matchStatus: match.status,
        candidates: match.candidates.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })),
        net: score.net,
        correctCount: score.correctCount,
        wrongQuestionNumbers: score.wrongQuestionNumbers,
        blankQuestionNumbers: score.blankQuestionNumbers,
      };
    });

    const matchedCount = preview.filter((r) => r.matchStatus === "matched").length;
    return NextResponse.json({ rows: preview, totalLines: preview.length, matchedCount, questionCount: questions.length });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("optical_upload_preview_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/optical-upload", handlePost);
