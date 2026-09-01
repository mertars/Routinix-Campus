import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const SUBJECT = "Matematik";
const FINDINGS_PAGE_SIZE = 100;

// GET — worker (scripts/xray-qa-review.ts) TAMAMEN ayrı bir süreç olarak
// çalışır; bu route sadece worker'ın DB'ye yazdığı durumu OKUR ve panelde
// gösterir — worker'ı kendisi TETİKLEMEZ (bkz. xray-pool-generation/route.ts
// ile AYNI desen).
async function handleGet(request: NextRequest) {
  try {
    await requirePlatformSession();
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;

    const [control, totalQuestions, reviewedAgg, categoryAgg, severityAgg, findings, openCount, activity] = await Promise.all([
      prisma.xrayQaReviewControl.findUnique({ where: { id: "singleton" } }),
      prisma.xrayPracticeQuestion.count({ where: { subject: SUBJECT } }),
      prisma.xrayQaReviewedRound.aggregate({ where: { subject: SUBJECT }, _count: { _all: true }, _sum: { questionCount: true, issuesFound: true, tokensUsed: true } }),
      prisma.xrayQaFinding.groupBy({ by: ["category"], where: { subject: SUBJECT }, _count: { _all: true } }),
      prisma.xrayQaFinding.groupBy({ by: ["severity"], where: { subject: SUBJECT }, _count: { _all: true } }),
      prisma.xrayQaFinding.findMany({
        where: { subject: SUBJECT },
        orderBy: { createdAt: "desc" },
        take: FINDINGS_PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      prisma.xrayQaFinding.count({ where: { subject: SUBJECT, status: "fix-failed" } }),
      prisma.xrayQaActivityLog.findMany({ where: { subject: SUBJECT }, orderBy: { createdAt: "desc" }, take: 40 }),
    ]);

    const totalRounds = await prisma.xrayPoolGenerationRound.count({ where: { subject: SUBJECT, status: "success" } });
    const reviewedRounds = reviewedAgg._count._all;
    const reviewedQuestions = reviewedAgg._sum.questionCount ?? 0;
    const percent = totalQuestions > 0 ? Math.min(100, Math.round((reviewedQuestions / totalQuestions) * 1000) / 10) : 0;

    const hasMore = findings.length > FINDINGS_PAGE_SIZE;
    const page = hasMore ? findings.slice(0, FINDINGS_PAGE_SIZE) : findings;

    return NextResponse.json({
      control: control ?? { paused: true, updatedAt: new Date().toISOString() },
      progress: {
        totalQuestions,
        reviewedQuestions,
        percent,
        totalRounds,
        reviewedRounds,
        remainingRounds: totalRounds - reviewedRounds,
        tokensUsed: reviewedAgg._sum.tokensUsed ?? 0,
      },
      summary: {
        totalFindings: reviewedAgg._sum.issuesFound ?? 0,
        needsManualFix: openCount,
        byCategory: Object.fromEntries(categoryAgg.map((c) => [c.category, c._count._all])),
        bySeverity: Object.fromEntries(severityAgg.map((s) => [s.severity, s._count._all])),
      },
      findings: page,
      nextCursor: hasMore ? page[page.length - 1]?.id : null,
      activity,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_qa_review_status_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST { action: "pause" | "resume" }
async function handlePost(request: NextRequest) {
  try {
    await requirePlatformSession();
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== "pause" && action !== "resume") return NextResponse.json({ error: "action 'pause' veya 'resume' olmalı." }, { status: 400 });

    const control = await prisma.xrayQaReviewControl.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", paused: action === "pause" },
      update: { paused: action === "pause" },
    });

    return NextResponse.json({ control });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_qa_review_control_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/xray-qa-review", handleGet);
export const POST = withApiLogging("POST /api/platform/xray-qa-review", handlePost);
