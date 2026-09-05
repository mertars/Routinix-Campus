import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { listStudentRosterForMatching } from "@/lib/server/admin/exam-net-results";
import { parseOpticalText, scoreOpticalAnswers, matchOpticalRow, type OpticalFormatDef } from "@/lib/server/exams/optical-import";

export const dynamic = "force-dynamic";

export type OpticalPreviewSubjectResult = {
  subject: string;
  net: number;
  correctCount: number;
  wrongQuestionNumbers: number[];
  blankQuestionNumbers: number[];
};

export type OpticalPreviewRow = {
  lineNumber: number;
  name: string | null;
  tcNo: string | null;
  studentNo: string | null;
  matchedStudentId: string | null;
  matchStatus: "matched" | "ambiguous" | "unmatched";
  candidates: { id: string; firstName: string; lastName: string }[];
  subjects: OpticalPreviewSubjectResult[];
};

// POST /api/exams/[id]/optical-upload — { formatId, rawText }. 2026-09-05
// düzeltmesi: kullanıcı haklı olarak "ders ders değil hepsini tek
// seferde kontrol etmesi lazım" dedi — gerçek bir optik dosyası zaten TÜM
// derslerin cevaplarını AYNI satırda taşıyor, önceden bu uç `subject`
// parametresi alıp aynı dosyayı ders başına ayrı ayrı yükletiyordu (aynı
// metni N kere yapıştırmak gibi anlamsız bir tekrar). Artık dosya BİR KEZ
// yüklenir, formatın TANIMLI OLDUĞU her ders (VE o dersin cevap anahtarı
// girilmişse) aynı geçişte puanlanır. Cevap anahtarı girilmemiş dersler
// sessizce atlanır ama `subjectsSkipped` ile bildirilir. HİÇBİR ŞEY
// KAYDETMEZ — sadece önizleme döner (bkz. confirm route).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const formatId = typeof body?.formatId === "string" ? body.formatId : "";
    const rawText = typeof body?.rawText === "string" ? body.rawText : "";
    if (!formatId || !rawText.trim()) {
      return NextResponse.json({ error: "formatId ve rawText zorunludur." }, { status: 400 });
    }

    const format = await prisma.opticalFormat.findUnique({
      where: { id: formatId },
      include: { subjectBlocks: { orderBy: { order: "asc" } } },
    });
    if (!format || format.institutionId !== session.institutionId) return NextResponse.json({ error: "Optik format bulunamadı." }, { status: 404 });
    if (format.subjectBlocks.length === 0) return NextResponse.json({ error: "Bu formatta hiç ders bloğu tanımlı değil." }, { status: 400 });

    const allQuestions = await prisma.examQuestion.findMany({
      where: { examId: params.id, subject: { in: format.subjectBlocks.map((b) => b.subject) } },
      select: { subject: true, questionNumber: true, correctAnswer: true },
      orderBy: { questionNumber: "asc" },
    });
    const questionsBySubject = new Map<string, { questionNumber: number; correctAnswer: string | null }[]>();
    for (const q of allQuestions) {
      const list = questionsBySubject.get(q.subject) ?? [];
      list.push({ questionNumber: q.questionNumber, correctAnswer: q.correctAnswer });
      questionsBySubject.set(q.subject, list);
    }

    const subjectsToScore = format.subjectBlocks.filter((b) => (questionsBySubject.get(b.subject)?.length ?? 0) > 0);
    const subjectsSkipped = format.subjectBlocks.filter((b) => !(questionsBySubject.get(b.subject)?.length ?? 0)).map((b) => b.subject);
    if (subjectsToScore.length === 0) {
      return NextResponse.json({ error: "Hiçbir ders için cevap anahtarı girilmemiş — önce en az bir dersin cevap anahtarını gir." }, { status: 400 });
    }

    const formatDef: OpticalFormatDef = {
      tcNo: format.tcNoStart && format.tcNoLength ? { start: format.tcNoStart, length: format.tcNoLength } : null,
      studentNo: format.studentNoStart && format.studentNoLength ? { start: format.studentNoStart, length: format.studentNoLength } : null,
      booklet: format.bookletStart && format.bookletLength ? { start: format.bookletStart, length: format.bookletLength } : null,
      grade: format.gradeStart && format.gradeLength ? { start: format.gradeStart, length: format.gradeLength } : null,
      branch: format.branchStart && format.branchLength ? { start: format.branchStart, length: format.branchLength } : null,
      name: format.nameStart && format.nameLength ? { start: format.nameStart, length: format.nameLength } : null,
    };

    const parsedRows = parseOpticalText(
      rawText,
      formatDef,
      subjectsToScore.map((b) => ({ subject: b.subject, start: b.start, length: b.length }))
    );
    if (parsedRows.length === 0) return NextResponse.json({ error: "Dosyada okunabilir satır bulunamadı." }, { status: 400 });

    const roster = await listStudentRosterForMatching(session.institutionId);

    const preview: OpticalPreviewRow[] = parsedRows.map((row) => {
      const match = matchOpticalRow(row, roster);
      const subjects: OpticalPreviewSubjectResult[] = subjectsToScore.map((block) => {
        const score = scoreOpticalAnswers(row.answersBySubject[block.subject] ?? "", questionsBySubject.get(block.subject) ?? []);
        return { subject: block.subject, ...score };
      });
      return {
        lineNumber: row.lineNumber,
        name: row.name,
        tcNo: row.tcNo,
        studentNo: row.studentNo,
        matchedStudentId: match.studentId,
        matchStatus: match.status,
        candidates: match.candidates.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName })),
        subjects,
      };
    });

    const matchedCount = preview.filter((r) => r.matchStatus === "matched").length;
    return NextResponse.json({
      rows: preview,
      totalLines: preview.length,
      matchedCount,
      subjectsScored: subjectsToScore.map((b) => b.subject),
      subjectsSkipped,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("optical_upload_preview_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/optical-upload", handlePost);
