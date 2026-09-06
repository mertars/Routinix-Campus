import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamResults } from "@/lib/server/exams/exam-results";
import { PdfExamKarne, type KarneSubjectRow, type KarneKonuRow } from "@/components/pdf/pdf-exam-karne";

export const dynamic = "force-dynamic";

const TREND_WINDOW = 6;

// GET /api/exams/[id]/karne/[studentId] — bir öğrencinin TEK bir deneme
// için karne PDF'i. Öğrenci/veli KENDİ karnesini görebilir (bkz. altta
// requireInstitution+ownership benzeri kontrol — bu uç principal/teacher
// İÇİN, ayrıca bkz. .../my-karne öğrenci-tarafı erişimi gerekirse ileride
// eklenir); şu an yönetim tarafındaki "PDF" ikonundan üretilip WhatsApp/
// panel paylaşımına konu olur.
async function handleGet(_request: NextRequest, { params }: { params: { id: string; studentId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const results = await computeExamResults(params.id);
    if (!results) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const me = results.students.find((s) => s.studentId === params.studentId);
    if (!me) return NextResponse.json({ error: "Bu öğrencinin bu denemede sonucu yok." }, { status: 404 });

    const [institution, questions] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      prisma.examQuestion.findMany({
        where: { examId: params.id, subject: { in: results.subjects } },
        select: { subject: true, questionNumber: true, subtopicLabel: true, correctAnswer: true },
        orderBy: [{ subject: "asc" }, { questionNumber: "asc" }],
      }),
    ]);

    const subjectStatMap = new Map(results.subjectStats.map((s) => [s.subject, s.averageNet]));
    const subjectRows: KarneSubjectRow[] = results.subjects.map((subject) => {
      const score = me.subjects.find((x) => x?.subject === subject);
      return {
        subject,
        correct: score?.correct ?? 0,
        wrong: score?.wrong ?? 0,
        blank: score?.blank ?? 0,
        net: score?.net ?? 0,
        classAverage: subjectStatMap.get(subject) ?? null,
      };
    });

    const branchStudentCount = results.students.filter((s) => s.branchName === me.branchName).length;
    const trackStudentCount = me.trackResult ? results.trackRankings.find((t) => t.track === me.trackResult?.track)?.students.length ?? 0 : 0;

    // Son N sınavın toplam net gelişimi — AYNI kategori/klasördeki (bkz.
    // Exam.categoryId) geçmiş denemeler arasından, kronolojik.
    const category = results.exam.categoryId
      ? await prisma.exam.findMany({
          where: { institutionId: session.institutionId, categoryId: results.exam.categoryId, examDate: { lte: results.exam.examDate } },
          orderBy: { examDate: "desc" },
          take: TREND_WINDOW,
          select: { id: true, name: true, examDate: true },
        })
      : [{ id: results.exam.id, name: results.exam.name, examDate: results.exam.examDate }];
    const historyExamIds = category.map((e) => e.id);
    const historyRows = await prisma.examNetResult.findMany({
      where: { examId: { in: historyExamIds }, studentId: params.studentId },
      select: { examId: true, net: true },
    });
    const netByExam = new Map<string, number>();
    for (const r of historyRows) netByExam.set(r.examId, (netByExam.get(r.examId) ?? 0) + r.net);
    const trend = [...category]
      .reverse()
      .filter((e) => netByExam.has(e.id))
      .map((e) => ({ label: e.name, net: Math.round((netByExam.get(e.id) ?? 0) * 100) / 100 }));

    // Konu analizi — SADECE gerçekten kazanım atanmış sorular (varsayılan
    // "Kazanım atanmadı" etiketiyle bir sayfa doldurmak faydasız olurdu).
    // Doğru/yanlış/boş, o dersin wrongQuestionNumbers/blankQuestionNumbers
    // dizilerinden (ExamNetResult) türetilir — ÖC (öğrencinin işaretlediği
    // yanlış şık) hiçbir yerde saklanmadığı için burada da YOK, bkz.
    // pdf-exam-karne.tsx'teki dürüstlük notu.
    const netResultsBySubject = await prisma.examNetResult.findMany({
      where: { examId: params.id, studentId: params.studentId },
      select: { subject: true, wrongQuestionNumbers: true, blankQuestionNumbers: true },
    });
    const wrongMap = new Map(netResultsBySubject.map((r) => [r.subject, new Set(r.wrongQuestionNumbers)]));
    const blankMap = new Map(netResultsBySubject.map((r) => [r.subject, new Set(r.blankQuestionNumbers)]));
    const finalKonuRows: KarneKonuRow[] = questions
      .filter((q) => q.subtopicLabel && q.subtopicLabel !== "Kazanım atanmadı")
      .map((q) => {
        const isCorrect = blankMap.get(q.subject)?.has(q.questionNumber) ? null : !wrongMap.get(q.subject)?.has(q.questionNumber);
        return { subject: q.subject, questionNumber: q.questionNumber, konu: q.subtopicLabel, correctAnswer: q.correctAnswer, isCorrect };
      });

    const pdfBuffer = await renderToBuffer(
      <PdfExamKarne
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        examName={results.exam.name}
        examDate={new Date(results.exam.examDate).toLocaleDateString("tr-TR")}
        studentName={`${me.firstName} ${me.lastName}`}
        branchName={me.branchName}
        studentNumber={me.studentNumber}
        subjects={subjectRows}
        totalNet={me.totalNet}
        studentCount={results.stats.studentCount}
        rank={me.rank}
        branchStudentCount={branchStudentCount}
        branchRank={me.branchRank}
        trackResult={me.trackResult ? { ...me.trackResult, studentCount: trackStudentCount } : null}
        trend={trend}
        konuRows={finalKonuRows}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="karne-${params.studentId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_karne_failed", { examId: params.id, studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/karne/[studentId]", handleGet);
