import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { computeExamResults } from "@/lib/server/exams/exam-results";
import { computeExamSubtopicBreakdown } from "@/lib/server/exams/subtopic-breakdown";
import { estimateRanking } from "@/lib/server/exams/osym-reference";
import { PdfExamKarne, type KarneSubjectRow, type KarneKonuRow } from "@/components/pdf/pdf-exam-karne";

export const dynamic = "force-dynamic";

const TREND_WINDOW = 6;

// GET /api/exams/[id]/karne/[studentId] — bir öğrencinin TEK bir deneme
// için karne PDF'i. Yönetim tarafındaki "PDF" ikonundan üretilip WhatsApp/
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

    const [institution, questions, netResultsBySubject] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      prisma.examQuestion.findMany({
        where: { examId: params.id, subject: { in: results.subjects } },
        select: { subject: true, questionNumber: true, subtopicLabel: true, correctAnswer: true },
        orderBy: [{ subject: "asc" }, { questionNumber: "asc" }],
      }),
      prisma.examNetResult.findMany({
        where: { examId: params.id, studentId: params.studentId },
        select: { subject: true, wrongQuestionNumbers: true, blankQuestionNumbers: true, answerLetters: true },
      }),
    ]);

    // Alt-ders kırılımı (2026-09-06, kullanıcı kararı: "sosyal ve fende
    // var zaten") — CURRICULUM_TREE'de OLMAYAN dersler (Sosyal Bilimler,
    // Fen Bilimleri gibi) için kazanım/konu etiketi genelde ZATEN geniş bir
    // alt-ders adı (Tarih/Coğrafya/Fizik/Kimya…) oluyor, çünkü o derste
    // seçilecek bir CURRICULUM_TREE dropdown'ı yok — admin doğrudan bunu
    // yazıyor. computeExamSubtopicBreakdown BUNU zaten label bazında
    // gruplanmış olarak veriyor; CURRICULUM_TREE'si olan (Matematik, Fizik,
    // Türkçe) derslerde bu ÇOK GRANÜLER olurdu (onlarca kazanım) — o
    // yüzden SADECE Röntgen köprüsü olmayan derslerde alt-ders satırı
    // gösteriyoruz, granüler kazanım kırılımı yine KONU ANALİZİ'nde kalıyor.
    const subDersBySubject = new Map<string, { label: string; correct: number; wrong: number; blank: number; net: number }[]>();
    for (const subject of results.subjects) {
      if (subject in CURRICULUM_TREE) continue;
      const breakdown = await computeExamSubtopicBreakdown(params.id, params.studentId, subject);
      const real = breakdown.filter((b) => b.subtopicLabel && b.subtopicLabel !== "Kazanım atanmadı");
      if (real.length <= 1) continue; // tek grup varsa "alt-ders" göstermenin anlamı yok
      subDersBySubject.set(
        subject,
        real.map((b) => ({ label: b.subtopicLabel, correct: b.correct, wrong: b.wrong, blank: b.blank, net: Math.round((b.correct - b.wrong / 4) * 100) / 100 }))
      );
    }

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
        subRows: subDersBySubject.get(subject) ?? [],
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

    // Konu analizi — SADECE gerçekten kazanım atanmış sorular. ÖC (öğrencinin
    // işaretlediği şık) artık GERÇEK: answerLetters optik okumadan geliyorsa
    // (bkz. ExamNetResult.answerLetters, 2026-09-06) o pozisyondaki harf
    // okunur; yoksa (elle giriş) "—" — var olmayanı uydurmuyoruz.
    const wrongMap = new Map(netResultsBySubject.map((r) => [r.subject, new Set(r.wrongQuestionNumbers)]));
    const blankMap = new Map(netResultsBySubject.map((r) => [r.subject, new Set(r.blankQuestionNumbers)]));
    const answersMap = new Map(netResultsBySubject.map((r) => [r.subject, r.answerLetters]));
    const finalKonuRows: KarneKonuRow[] = questions
      .filter((q) => q.subtopicLabel && q.subtopicLabel !== "Kazanım atanmadı")
      .map((q) => {
        const isBlank = blankMap.get(q.subject)?.has(q.questionNumber) ?? false;
        const isCorrect = isBlank ? null : !wrongMap.get(q.subject)?.has(q.questionNumber);
        const raw = answersMap.get(q.subject);
        const studentAnswer = !isBlank && raw ? raw[q.questionNumber - 1]?.toUpperCase() ?? null : null;
        return {
          subject: q.subject,
          questionNumber: q.questionNumber,
          konu: q.subtopicLabel,
          correctAnswer: q.correctAnswer,
          studentAnswer: studentAnswer && /^[A-E]$/.test(studentAnswer) ? studentAnswer : null,
          isCorrect,
        };
      });

    // ÖSYM tahmini sıralama — kurumun KENDİ girdiği referans tabloya göre
    // (bkz. lib/server/exams/osym-reference.ts'teki dürüstlük notu). Alan
    // (track) varsa o alanın adı, yoksa denemenin klasör adı (örn. "TYT")
    // puanTuru olarak denenir.
    const category2 = results.exam.categoryId ? await prisma.examCategory.findUnique({ where: { id: results.exam.categoryId }, select: { name: true } }) : null;
    const puanTuru = me.trackResult?.track ?? category2?.name ?? null;
    const netForOsym = me.trackResult?.net ?? me.totalNet;
    const osymEstimate = puanTuru ? await estimateRanking(session.institutionId, puanTuru, netForOsym) : null;

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
        osymEstimate={osymEstimate}
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
