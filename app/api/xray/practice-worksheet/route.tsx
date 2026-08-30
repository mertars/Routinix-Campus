import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { PdfPracticeWorksheet } from "@/components/pdf/pdf-practice-worksheet";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-worksheet?attemptId=X — "isterse pdf çıkarıp
// hocasıyla anlayarak çözecek" — sadece SORULAR (çözüm/cevap YOK), basılıp
// üzerine çalışılacak bir kağıt. Faz G: havuzdan rastgele derlenen bir
// test artık KENDİ başına bir kimliğe (testId) sahip değil — bu yüzden
// PDF, öğrencinin O AN çözdüğü SPESİFİK attempt'in soru seçimini yansıtır
// (ekranda gördüğüyle BİREBİR aynı sorular).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const attemptId = request.nextUrl.searchParams.get("attemptId");
    if (!attemptId?.trim()) return NextResponse.json({ error: "attemptId parametresi zorunludur." }, { status: 400 });

    const attempt = await prisma.xrayPracticeAttempt.findUnique({ where: { id: attemptId.trim() } });
    if (!attempt) return NextResponse.json({ error: "Test oturumu bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, attempt.studentId);

    const [institution, attemptQuestions] = await Promise.all([
      prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } }),
      prisma.xrayPracticeAttemptQuestion.findMany({
        where: { attemptId: attempt.id },
        orderBy: { order: "asc" },
        include: { question: { select: { prompt: true } } },
      }),
    ]);

    const topicName = (CURRICULUM_TREE[attempt.subject] ?? [])
      .flatMap((t) => t.subtopics)
      .find((s) => s.id === attempt.subtopicId)?.name ?? attempt.subtopicId;

    const pdfBuffer = await renderToBuffer(
      <PdfPracticeWorksheet
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        testName={`Konu Bilgisi Testi — ${topicName}`}
        subject={attempt.subject}
        questions={attemptQuestions.map((aq, index) => ({ order: index + 1, prompt: aq.question.prompt }))}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="calisma-yapragi-${attemptId}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_worksheet_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-worksheet", handleGet);
