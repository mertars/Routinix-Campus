import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// PATCH /api/questions/:id — iki farklı aktör, iki farklı geçiş yapar:
// ÖĞRETMEN (question.teacherId sahibi): { answerText } → PENDING/ANSWERED'dan ANSWERED'a.
// ÖĞRENCİ (question.studentId sahibi): { status: "SOLVED" } → SADECE zaten
// ANSWERED olan kendi sorusunu "anladım" diyerek kapatır (PENDING'i atlayarak
// doğrudan SOLVED'a geçemez — cevap görmeden "çözüldü" denemez).
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
    }

    const existing = await prisma.question.findUnique({ where: { id: params.id }, select: { id: true, teacherId: true, studentId: true, status: true } });
    if (!existing) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });

    if (session.role === "STUDENT") {
      assertOwnsSelf(session, existing.studentId);
      const status = (body as { status?: unknown })?.status;
      if (status !== "SOLVED") {
        return NextResponse.json({ error: "Öğrenci sadece soruyu 'çözüldü' olarak işaretleyebilir." }, { status: 400 });
      }
      if (existing.status !== "ANSWERED") {
        return NextResponse.json({ error: "Henüz yanıtlanmamış bir soru çözüldü olarak işaretlenemez." }, { status: 409 });
      }
      const question = await prisma.question.update({ where: { id: params.id }, data: { status: "SOLVED" } });
      return NextResponse.json({ question });
    }

    if (session.role !== "TEACHER" || existing.teacherId !== session.sub) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    const answerText = typeof (body as { answerText?: unknown })?.answerText === "string" ? (body as { answerText: string }).answerText.trim() : "";
    if (!answerText) {
      return NextResponse.json({ error: "Yanıt metni boş olamaz." }, { status: 400 });
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
