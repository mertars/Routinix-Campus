import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { flattenCurriculum, flattenTopics } from "@/lib/server/xray/question-generation/curriculum-flatten";

export const dynamic = "force-dynamic";

const SUBJECT = "Matematik";
// "yeterlilik" bilerek kaldırıldı — bkz. xray-pool-generation/route.ts'teki
// AYNI notun.
const VARIANTS = ["genel", "alt_konu"] as const;
type Variant = (typeof VARIANTS)[number];

function unitsForVariant(variant: Variant): { unitId: string; label: string }[] {
  if (variant === "alt_konu") return flattenCurriculum(SUBJECT).map((s) => ({ unitId: s.subtopicId, label: `${s.grade}.${s.topicName} › ${s.subtopicName}` }));
  return flattenTopics(SUBJECT).map((t) => ({ unitId: t.topicId, label: `${t.grade}. Sınıf > ${t.topicName}` }));
}

// GET ?variant=genel|alt_konu → birim + başarılı tur listesi
// (soru listesi YOK, sadece testId/roundNumber/soru sayısı — havuz
// tarayıcısının "birim → tur" ilk iki seviyesi).
// GET ?testId=... → o turun TÜM sorularını (düzenlenebilir alanlarla) döner.
async function handleGet(request: NextRequest) {
  try {
    await requirePlatformSession();
    const testId = request.nextUrl.searchParams.get("testId");

    if (testId) {
      const round = await prisma.xrayPoolGenerationRound.findFirst({ where: { subject: SUBJECT, testId } });
      const questions = await prisma.xrayPracticeQuestion.findMany({ where: { testId }, orderBy: { order: "asc" } });
      if (questions.length === 0) return NextResponse.json({ error: "Bu tura ait soru bulunamadı." }, { status: 404 });
      return NextResponse.json({
        testId,
        testName: questions[0].testName,
        roundNumber: round?.roundNumber ?? null,
        questions: questions.map((q) => ({
          id: q.id,
          order: q.order,
          kazanimId: q.kazanimId,
          prompt: q.prompt,
          correctAnswer: q.correctAnswer,
          solution: q.solution,
          checks: q.checks,
        })),
      });
    }

    const requestedVariant = (request.nextUrl.searchParams.get("variant") as Variant) ?? "genel";
    const variant: Variant = VARIANTS.includes(requestedVariant) ? requestedVariant : "genel";

    const successRounds = await prisma.xrayPoolGenerationRound.findMany({
      where: { subject: SUBJECT, variant, status: "success" },
      orderBy: [{ unitId: "asc" }, { roundNumber: "asc" }],
      select: { unitId: true, roundNumber: true, testId: true },
    });
    const testIds = successRounds.map((r) => r.testId).filter((id): id is string => !!id);
    const questionCounts = await prisma.xrayPracticeQuestion.groupBy({ by: ["testId"], where: { testId: { in: testIds } }, _count: true });
    const countByTestId = new Map(questionCounts.map((c) => [c.testId, c._count]));

    const roundsByUnit = new Map<string, { roundNumber: number; testId: string; questionCount: number }[]>();
    for (const r of successRounds) {
      if (!r.testId) continue;
      const list = roundsByUnit.get(r.unitId) ?? [];
      list.push({ roundNumber: r.roundNumber, testId: r.testId, questionCount: countByTestId.get(r.testId) ?? 0 });
      roundsByUnit.set(r.unitId, list);
    }

    const units = unitsForVariant(variant)
      .map((u) => ({ unitId: u.unitId, label: u.label, rounds: roundsByUnit.get(u.unitId) ?? [] }))
      .filter((u) => u.rounds.length > 0);

    return NextResponse.json({ variant, units });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_pool_questions_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/xray-pool-questions", handleGet);
