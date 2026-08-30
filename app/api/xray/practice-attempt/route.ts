import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { pickRandomTestFromPool } from "@/lib/server/xray/practice-pool";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-attempt — { studentId, subject, subtopicId } —
// Test 1 (Konu Bilgisi) oturumu başlatır. Faz G: artık belirli bir testId
// SEÇİLMİYOR — subject+subtopicId havuzundaki TÜM sorular kazanımId'ye
// göre gruplanır, her kazanımdan RASTGELE bir soru çekilir (bkz.
// lib/server/xray/practice-pool.ts) ve bu seçim XrayPracticeAttemptQuestion'a
// SABİTLENİR (aynı attempt tekrar açılsa bile AYNI sorular gelir — sadece
// YENİ bir attempt farklı bir rastgele seçim yapar).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const body = await request.json();
    const { studentId, subject, subtopicId } = body as { studentId?: string; subject?: string; subtopicId?: string };
    if (!studentId || !subject?.trim() || !subtopicId?.trim()) {
      return NextResponse.json({ error: "studentId, subject ve subtopicId zorunludur." }, { status: 400 });
    }
    assertOwnsSelf(session, studentId);

    const pool = await prisma.xrayPracticeQuestion.findMany({
      where: { subject: subject.trim(), subtopicId: subtopicId.trim() },
      select: { id: true, kazanimId: true, order: true, testId: true },
    });
    if (pool.length === 0) return NextResponse.json({ error: "Bu konu için soru havuzu boş." }, { status: 404 });

    const selection = pickRandomTestFromPool(pool);

    const attempt = await prisma.xrayPracticeAttempt.create({
      data: {
        studentId,
        subject: subject.trim(),
        subtopicId: subtopicId.trim(),
        questions: { create: selection.map((s) => ({ questionId: s.id, order: s.order })) },
      },
    });

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { id: { in: selection.map((s) => s.id) } },
      select: { id: true, prompt: true },
    });
    const promptById = new Map(questions.map((q) => [q.id, q.prompt]));
    const ordered = selection.map((s) => ({ id: s.id, order: s.order, prompt: promptById.get(s.id) ?? "" }));

    return NextResponse.json({ attemptId: attempt.id, questions: ordered }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_attempt_start_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-attempt", handlePost);
