import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { PdfPracticeWorksheet } from "@/components/pdf/pdf-practice-worksheet";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-worksheet?testId=X — "isterse pdf çıkarıp
// hocasıyla anlayarak çözecek" — sadece SORULAR (çözüm/cevap YOK), basılıp
// üzerine çalışılacak bir kağıt. Kurum logosu/adı içerir (bkz. Faz F —
// öğrencinin ekrandaki güzel deneyimiyle tutarlı olsun diye artık markalı).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();

    const testId = request.nextUrl.searchParams.get("testId");
    if (!testId?.trim()) return NextResponse.json({ error: "testId parametresi zorunludur." }, { status: 400 });

    const [institution, questions] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      prisma.xrayPracticeQuestion.findMany({
        where: { testId: testId.trim() },
        orderBy: { order: "asc" },
        select: { order: true, prompt: true, testName: true, subject: true },
      }),
    ]);
    if (questions.length === 0) return NextResponse.json({ error: "Bu test için soru bulunamadı." }, { status: 404 });

    const pdfBuffer = await renderToBuffer(
      <PdfPracticeWorksheet
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        testName={questions[0].testName}
        subject={questions[0].subject}
        questions={questions.map((q) => ({ order: q.order, prompt: q.prompt }))}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="calisma-yapragi-${testId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_worksheet_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-worksheet", handleGet);
