import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamResults } from "@/lib/server/exams/exam-results";
import { TRACK_SUBJECTS } from "@/lib/server/exams/track-mapping";
import { PdfExamRanking, type RankingRow } from "@/components/pdf/pdf-exam-ranking";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/ranking-pdf?track= — sıralama listesi PDF'i.
// Kullanıcı geri bildirimi: "sadece net yazıyor, her dersin sonucunu
// istiyorum" — artık her öğrenci satırında TÜM (ya da alan bazlıysa o
// alana ait) derslerin doğru/yanlış/net'i de var, sadece toplam DEĞİL.
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const results = await computeExamResults(params.id);
    if (!results) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const track = request.nextUrl.searchParams.get("track");
    let subjects: string[];
    let rows: RankingRow[];
    let listTitle: string;
    let totalLabel: string;

    if (track) {
      const trackRanking = results.trackRankings.find((t) => t.track === track);
      if (!trackRanking) return NextResponse.json({ error: "Bu denemede bu alan bulunamadı." }, { status: 400 });
      const trackSubjectSet = new Set(TRACK_SUBJECTS[track] ?? []);
      subjects = results.subjects.filter((s) => trackSubjectSet.has(s));

      const byId = new Map(results.students.map((s) => [s.studentId, s]));
      rows = trackRanking.students.map((ts) => {
        const full = byId.get(ts.studentId);
        return {
          rank: ts.rank,
          firstName: ts.firstName,
          lastName: ts.lastName,
          branchName: ts.branchName,
          subjects: subjects.map((subj) => {
            const cell = full?.subjects.find((x) => x?.subject === subj);
            return cell ? { correct: cell.correct, wrong: cell.wrong, blank: cell.blank, net: cell.net } : null;
          }),
          totalNet: ts.trackNet,
        };
      });
      listTitle = `${track} Sıralaması`;
      totalLabel = `${track} Net`;
    } else {
      subjects = results.subjects;
      rows = results.students.map((s) => ({
        rank: s.rank,
        firstName: s.firstName,
        lastName: s.lastName,
        branchName: s.branchName,
        subjects: s.subjects.map((cell) => (cell ? { correct: cell.correct, wrong: cell.wrong, blank: cell.blank, net: cell.net } : null)),
        totalNet: s.totalNet,
      }));
      listTitle = "Genel Sıralama";
      totalLabel = "Toplam Net";
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfExamRanking
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        examName={results.exam.name}
        examDate={new Date(results.exam.examDate).toLocaleDateString("tr-TR")}
        listTitle={listTitle}
        subjects={subjects}
        totalLabel={totalLabel}
        rows={rows}
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
