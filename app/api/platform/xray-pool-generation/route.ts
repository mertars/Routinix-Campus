import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { flattenCurriculum } from "@/lib/server/xray/question-generation/curriculum-flatten";

export const dynamic = "force-dynamic";

const SUBJECT = "Matematik";

// GET — worker (scripts/xray-generate-question-pool.ts) TAMAMEN ayrı bir
// süreç olarak çalışır (Vercel'de değil); bu route sadece worker'ın DB'ye
// yazdığı durumu (XrayPoolGenerationRound/Control) OKUR ve panelde gösterir
// — worker'ı kendisi TETİKLEMEZ.
async function handleGet() {
  try {
    await requirePlatformSession();

    const [control, roundGroups, questionGroups] = await Promise.all([
      prisma.xrayPoolGenerationControl.findUnique({ where: { id: "singleton" } }),
      prisma.xrayPoolGenerationRound.groupBy({ by: ["subtopicId", "status"], where: { subject: SUBJECT }, _count: true }),
      prisma.xrayPracticeQuestion.groupBy({ by: ["subtopicId"], where: { subject: SUBJECT }, _count: true }),
    ]);

    const roundCounts = new Map<string, { success: number; failed: number }>();
    for (const g of roundGroups) {
      const entry = roundCounts.get(g.subtopicId) ?? { success: 0, failed: 0 };
      if (g.status === "success") entry.success += g._count;
      else entry.failed += g._count;
      roundCounts.set(g.subtopicId, entry);
    }
    const questionCounts = new Map(questionGroups.map((g) => [g.subtopicId, g._count]));

    const subtopics = flattenCurriculum(SUBJECT).map((s) => {
      const rounds = roundCounts.get(s.subtopicId) ?? { success: 0, failed: 0 };
      return {
        subtopicId: s.subtopicId,
        subtopicName: s.subtopicName,
        topicName: s.topicName,
        grade: s.grade,
        roundsSuccess: rounds.success,
        roundsFailed: rounds.failed,
        questionCount: questionCounts.get(s.subtopicId) ?? 0,
      };
    });

    const totals = subtopics.reduce(
      (acc, s) => ({
        questionCount: acc.questionCount + s.questionCount,
        roundsSuccess: acc.roundsSuccess + s.roundsSuccess,
        roundsFailed: acc.roundsFailed + s.roundsFailed,
      }),
      { questionCount: 0, roundsSuccess: 0, roundsFailed: 0 },
    );

    return NextResponse.json({
      control: control ?? { paused: true, dailyTokenBudget: 15_000_000, tokensUsedToday: 0, tokensUsedTotal: 0, budgetResetAt: new Date().toISOString() },
      subtopics,
      totals,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_pool_generation_status_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST { action: "pause" | "resume" } — worker her turdan önce bu bayrağı
// taze okur (bkz. scripts/xray-generate-question-pool.ts), bu yüzden
// "Duraklat" panelden basılınca worker'ı öldürmeye gerek kalmadan bir
// sonraki turdan önce durur.
async function handlePost(request: NextRequest) {
  try {
    await requirePlatformSession();
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== "pause" && action !== "resume") return NextResponse.json({ error: "action 'pause' veya 'resume' olmalı." }, { status: 400 });

    const control = await prisma.xrayPoolGenerationControl.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", paused: action === "pause" },
      update: { paused: action === "pause" },
    });

    return NextResponse.json({ control });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_pool_generation_control_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/xray-pool-generation", handleGet);
export const POST = withApiLogging("POST /api/platform/xray-pool-generation", handlePost);
