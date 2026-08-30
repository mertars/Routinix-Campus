import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { PdfPracticeWorksheet } from "@/components/pdf/pdf-practice-worksheet";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-worksheet?subject=Matematik&subtopicId=mt9-2 —
// "isterse pdf çıkarıp hocasıyla anlayarak çözecek" — sadece SORULAR
// (çözüm/cevap YOK), basılıp üzerine çalışılacak bir kağıt.
async function handleGet(request: NextRequest) {
  try {
    await requireSession();

    const subject = request.nextUrl.searchParams.get("subject");
    const subtopicId = request.nextUrl.searchParams.get("subtopicId");
    if (!subject?.trim() || !subtopicId?.trim()) {
      return NextResponse.json({ error: "subject ve subtopicId parametreleri zorunludur." }, { status: 400 });
    }

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { subject, subtopicId },
      orderBy: { difficulty: "asc" },
      select: { format: true, prompt: true, options: true },
    });

    let topicName = subtopicId;
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      const match = topic.subtopics.find((s) => s.id === subtopicId);
      if (match) topicName = match.name;
    }

    const pdfBuffer = await renderToBuffer(<PdfPracticeWorksheet topicName={topicName} subject={subject} questions={questions} />);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="calisma-yapragi-${subtopicId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_worksheet_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-worksheet", handleGet);
