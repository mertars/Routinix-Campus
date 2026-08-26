import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// PATCH /api/questions/:id — öğrencinin SEÇTİĞİ öğretmen soruyu yanıtlar.
// Sadece o soruya atanan öğretmen (question.teacherId) yanıtlayabilir —
// başka bir öğretmen (aynı kurumda bile olsa) bu soruyu göremez/yanıtlayamaz.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

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

    const existing = await prisma.question.findUnique({ where: { id: params.id }, select: { id: true, teacherId: true } });
    if (!existing || existing.teacherId !== session.sub) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    const question = await prisma.question.update({
      where: { id: params.id },
      data: { answerText, status: "ANSWERED", answeredAt: new Date() },
    });

    return NextResponse.json({ question });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("question_answer_failed", { questionId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/questions/[id]", handlePatch);
