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
import { TRACK_SUBJECTS } from "@/lib/server/exams/track-mapping";
import { PdfExamRanking, type RankingColumnGroup, type RankingStudentRow } from "@/components/pdf/pdf-exam-ranking";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/ranking-pdf?track= — sıralama listesi PDF'i.
// Kullanıcının paylaştığı gerçek örneğe (edesis "TYT Puan/İsim Sıralı
// Liste") birebir yakın: her ders VE varsa alt-dersi KENDİ Doğru/Yanlış/
// Net sütununu taşır (bkz. pdf-exam-ranking.tsx). "Kaç doğru kaç yanlış"
// artık tek bir sıkışık hücre değil, her biri AYRI sütun.
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const results = await computeExamResults(params.id);
    if (!results) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const track = request.nextUrl.searchParams.get("track");
    const scopedSubjects = track ? results.subjects.filter((s) => (TRACK_SUBJECTS[track] ?? []).includes(s)) : results.subjects;
    if (track && scopedSubjects.length === 0) return NextResponse.json({ error: "Bu denemede bu alan bulunamadı." }, { status: 400 });

    // Hangi dersler alt-ders kırılımına sahip (bkz. karne route'taki AYNI
    // mantık) — CURRICULUM_TREE'de olmayan VE birden fazla gerçek kazanım
    // etiketi olan dersler. SORGUYU ders başına BİR KEZ yapıyoruz (öğrenci
    // sayısı kadar değil), sonra her öğrenci için computeExamSubtopicBreakdown
    // çağırıyoruz.
    // findMany + questionNumber sırası (groupBy DEĞİL) — alt-ders sütunları
    // fiziksel soru sırasıyla (Tarih→Coğrafya→Felsefe→Din Kültürü) çıksın,
    // groupBy'ın TANIMSIZ satır sırasına bağlı kalmasın.
    const orderedQuestions = await prisma.examQuestion.findMany({
      where: { examId: params.id, subject: { in: scopedSubjects } },
      select: { subject: true, subtopicLabel: true },
      orderBy: { questionNumber: "asc" },
    });
    const labelsBySubject = new Map<string, Set<string>>();
    for (const q of orderedQuestions) {
      if (!q.subtopicLabel || q.subtopicLabel === "Kazanım atanmadı") continue;
      const set = labelsBySubject.get(q.subject) ?? new Set<string>();
      set.add(q.subtopicLabel);
      labelsBySubject.set(q.subject, set);
    }
    const subDersSubjects = scopedSubjects.filter((s) => !(s in CURRICULUM_TREE) && (labelsBySubject.get(s)?.size ?? 0) > 1);

    // Kolon grupları — fiziksel sırayla: alt-dersi olan dersler kendi alt
    // grup adlarını (Tarih/Coğrafya/…), diğerleri kendi ders adını taşır.
    const columnGroups: RankingColumnGroup[] = [];
    const columnKeys: { subject: string; label: string }[] = []; // subject + (alt-ders varsa) label
    for (const subject of scopedSubjects) {
      if (subDersSubjects.includes(subject)) {
        for (const label of labelsBySubject.get(subject) ?? []) {
          columnGroups.push({ label });
          columnKeys.push({ subject, label });
        }
      } else {
        columnGroups.push({ label: subject });
        columnKeys.push({ subject, label: "" });
      }
    }

    const relevantStudentIds = track ? (results.trackRankings.find((t) => t.track === track)?.students.map((s) => s.studentId) ?? []) : results.students.map((s) => s.studentId);
    const relevantStudents = results.students.filter((s) => relevantStudentIds.includes(s.studentId));

    // Öğrenci başına alt-ders kırılımı — SADECE alt-dersi olan derslerde.
    const breakdownByStudentSubject = new Map<string, Awaited<ReturnType<typeof computeExamSubtopicBreakdown>>>();
    for (const student of relevantStudents) {
      for (const subject of subDersSubjects) {
        const breakdown = await computeExamSubtopicBreakdown(params.id, student.studentId, subject);
        breakdownByStudentSubject.set(`${student.studentId}|${subject}`, breakdown);
      }
    }

    const trackByStudent = new Map(results.trackRankings.flatMap((tr) => tr.students.map((s) => [s.studentId, s] as const)));
    const puanTuru = track ?? null;
    const estimateCache = new Map<number, { tableName: string; estimatedRanking: number } | null>();
    async function estimateFor(net: number) {
      if (!puanTuru) return null;
      if (!estimateCache.has(net)) estimateCache.set(net, await estimateRanking(session.institutionId, puanTuru, net));
      return estimateCache.get(net) ?? null;
    }

    const rows: RankingStudentRow[] = [];
    for (const student of relevantStudents) {
      const cells = columnKeys.map(({ subject, label }) => {
        if (label) {
          const breakdown = breakdownByStudentSubject.get(`${student.studentId}|${subject}`) ?? [];
          const row = breakdown.find((b) => b.subtopicLabel === label);
          if (!row) return null;
          return { correct: row.correct, wrong: row.wrong, net: Math.round((row.correct - row.wrong / 4) * 100) / 100 };
        }
        const cell = student.subjects.find((x) => x?.subject === subject);
        return cell ? { correct: cell.correct, wrong: cell.wrong, net: cell.net } : null;
      });

      const totalCorrect = student.subjects.reduce((sum, c) => sum + (c?.correct ?? 0), 0);
      const totalWrong = student.subjects.reduce((sum, c) => sum + (c?.wrong ?? 0), 0);
      const totalBlank = student.subjects.reduce((sum, c) => sum + (c?.blank ?? 0), 0);
      const trackRow = track ? trackByStudent.get(student.studentId) : null;
      const totalNet = track ? (trackRow?.trackNet ?? 0) : student.totalNet;
      const rank = track ? (trackRow?.rank ?? 0) : student.rank;

      rows.push({
        firstName: student.firstName,
        lastName: student.lastName,
        branchName: student.branchName,
        cells,
        totalCorrect,
        totalWrong,
        totalBlank,
        totalNet,
        rank,
        branchRank: student.branchRank,
        gradeRank: student.gradeRank,
        estimatedRanking: (await estimateFor(totalNet))?.estimatedRanking ?? null,
      });
    }

    const hasEstimate = rows.some((r) => r.estimatedRanking !== null);
    const listTitle = track ? `${track} Sıralaması` : "Genel Sıralama";
    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfExamRanking
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        examName={results.exam.name}
        examDate={new Date(results.exam.examDate).toLocaleDateString("tr-TR")}
        listTitle={listTitle}
        columnGroups={columnGroups}
        rows={rows}
        hasEstimate={hasEstimate}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="siralama-${params.id}${track ? `-${track}` : ""}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_ranking_pdf_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/ranking-pdf", handleGet);
