import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamResults } from "@/lib/server/exams/exam-results";
import { PdfExamRanking, type RankingRow } from "@/components/pdf/pdf-exam-ranking";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/ranking-pdf?track= — sıralama listesi PDF'i.
// track verilmezse GENEL sıralama (toplam net); track="Sayısal" gibi
// verilirse SADECE o alanın öğrencileri, o alana ait derslerin neti
// üzerinden (bkz. lib/server/exams/track-mapping.ts).
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const results = await computeExamResults(params.id);
    if (!results) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const track = request.nextUrl.searchParams.get("track");
    let rows: RankingRow[];
    let listTitle: string;
    let netLabel: string;

    if (track) {
      const trackRanking = results.trackRankings.find((t) => t.track === track);
      if (!trackRanking) return NextResponse.json({ error: "Bu denemede bu alan bulunamadı." }, { status: 400 });
      rows = trackRanking.students.map((s) => ({ rank: s.rank, firstName: s.firstName, lastName: s.lastName, branchName: s.branchName, net: s.trackNet }));
      listTitle = `${track} Sıralaması`;
      netLabel = `${track} Net`;
    } else {
      rows = results.students.map((s) => ({ rank: s.rank, firstName: s.firstName, lastName: s.lastName, branchName: s.branchName, net: s.totalNet }));
      listTitle = "Genel Sıralama";
      netLabel = "Toplam Net";
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfExamRanking
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        examName={results.exam.name}
        examDate={new Date(results.exam.examDate).toLocaleDateString("tr-TR")}
        listTitle={listTitle}
        netLabel={netLabel}
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
