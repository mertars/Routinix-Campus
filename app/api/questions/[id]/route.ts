import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

// PATCH /api/questions/:id — öğretmen soruyu yanıtlar.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }

    const answerText = typeof (body as { answerText?: unknown })?.answerText === "string" ? (body as { answerText: string }).answerText.trim() : "";
    if (!answerText) {
      return NextResponse.json({ error: "Yanıt metni boş olamaz." }, { status: 400 });
    }

    const existing = await prisma.question.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!existing) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    const question = await prisma.question.update({
      where: { id: params.id },
      data: { answerText, status: "ANSWERED", answeredAt: new Date() },
    });

    return NextResponse.json({ question });
  } catch (error) {
    logger.error("question_answer_failed", { questionId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/questions/[id]", handlePatch);
