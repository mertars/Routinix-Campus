import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { flattenCurriculum, flattenTopics } from "@/lib/server/xray/question-generation/curriculum-flatten";

export const dynamic = "force-dynamic";

const SUBJECT = "Matematik";
const TARGET_ROUNDS = 10;
const VARIANTS = ["genel", "alt_konu", "yeterlilik"] as const;
type Variant = (typeof VARIANTS)[number];

// "genel"/"yeterlilik" TEMA (topicId) bazlı birim listesi kullanır, "alt_konu"
// SUBTOPIC (subtopicId) bazlı — bkz. prisma/schema.prisma XrayPoolGeneration
// Round yorumu.
function unitsForVariant(variant: Variant): { unitId: string; label: string }[] {
  if (variant === "alt_konu") return flattenCurriculum(SUBJECT).map((s) => ({ unitId: s.subtopicId, label: `${s.grade}.${s.topicName} › ${s.subtopicName}` }));
  return flattenTopics(SUBJECT).map((t) => ({ unitId: t.topicId, label: `${t.grade}. Sınıf > ${t.topicName}` }));
}

// GET ?variant=genel|alt_konu|yeterlilik — worker (scripts/xray-generate-
// question-pool.ts) TAMAMEN ayrı bir süreç olarak çalışır (Vercel'de değil);
// bu route sadece worker'ın DB'ye yazdığı durumu OKUR ve panelde gösterir —
// worker'ı kendisi TETİKLEMEZ.
async function handleGet(request: NextRequest) {
  try {
    await requirePlatformSession();
    const requestedVariant = (request.nextUrl.searchParams.get("variant") as Variant) ?? "genel";
    const variant: Variant = VARIANTS.includes(requestedVariant) ? requestedVariant : "genel";

    const [control, roundGroups, questionGroups] = await Promise.all([
      prisma.xrayPoolGenerationControl.findUnique({ where: { id: "singleton" } }),
      prisma.xrayPoolGenerationRound.groupBy({ by: ["variant", "unitId", "status"], where: { subject: SUBJECT }, _count: true }),
      prisma.xrayPracticeQuestion.groupBy({ by: ["variant", "subtopicId"], where: { subject: SUBJECT }, _count: true }),
    ]);

    // subtopicId -> topicId eşlemesi ("genel"/"yeterlilik" soru sayısını
    // TEMA bazında toplamak için — her soru kendi subtopicId'sine yazılır,
    // ama panelde tema düzeyinde gösteriliyor).
    const subtopicToTopic = new Map(flattenCurriculum(SUBJECT).map((s) => [s.subtopicId, s.topicId]));

    function summaryFor(v: Variant) {
      const units = unitsForVariant(v);
      const roundsByUnit = new Map<string, { success: number; failed: number }>();
      for (const g of roundGroups) {
        if (g.variant !== v) continue;
        const entry = roundsByUnit.get(g.unitId) ?? { success: 0, failed: 0 };
        if (g.status === "success") entry.success += g._count;
        else entry.failed += g._count;
        roundsByUnit.set(g.unitId, entry);
      }
      const questionsByUnit = new Map<string, number>();
      for (const g of questionGroups) {
        if (g.variant !== v) continue;
        const unitId = v === "alt_konu" ? g.subtopicId : (subtopicToTopic.get(g.subtopicId) ?? g.subtopicId);
        questionsByUnit.set(unitId, (questionsByUnit.get(unitId) ?? 0) + g._count);
      }

      const unitRows = units.map((u) => {
        const rounds = roundsByUnit.get(u.unitId) ?? { success: 0, failed: 0 };
        return { unitId: u.unitId, label: u.label, roundsSuccess: rounds.success, roundsFailed: rounds.failed, questionCount: questionsByUnit.get(u.unitId) ?? 0 };
      });
      const totals = unitRows.reduce(
        (acc, u) => ({ questionCount: acc.questionCount + u.questionCount, roundsSuccess: acc.roundsSuccess + u.roundsSuccess, roundsFailed: acc.roundsFailed + u.roundsFailed }),
        { questionCount: 0, roundsSuccess: 0, roundsFailed: 0 },
      );
      return { unitCount: units.length, targetRounds: TARGET_ROUNDS, totalTargetRounds: units.length * TARGET_ROUNDS, totals, unitRows };
    }

    const computed = new Map(VARIANTS.map((v) => [v, summaryFor(v)]));
    const summaries = Object.fromEntries(VARIANTS.map((v) => [v, { unitCount: computed.get(v)!.unitCount, targetRounds: TARGET_ROUNDS, totalTargetRounds: computed.get(v)!.totalTargetRounds, totals: computed.get(v)!.totals }]));
    const selected = computed.get(variant)!;

    return NextResponse.json({
      control: control ?? { paused: true, activeVariants: ["genel"], dailyTokenBudget: 15_000_000, tokensUsedToday: 0, tokensUsedTotal: 0, budgetResetAt: new Date().toISOString() },
      variant,
      summaries,
      units: selected.unitRows,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_pool_generation_status_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST { action: "pause" | "resume", variant?: "genel"|"alt_konu"|"yeterlilik" }
// resume: verilen variant'ı activeVariants'a EKLER (diğerleri aktif kalmaya
// devam eder — kullanıcı birden fazlasını "birlikte" aktif edebilir, worker
// bunları sırayla/round-robin işler, bkz. schema yorumu). pause (variant'sız):
// worker'ı TAMAMEN durdurur. pause+variant: sadece o variant'ı listeden çıkarır.
async function handlePost(request: NextRequest) {
  try {
    await requirePlatformSession();
    const body = await request.json().catch(() => null);
    const action = body?.action;
    const variant = body?.variant as Variant | undefined;
    if (action !== "pause" && action !== "resume") return NextResponse.json({ error: "action 'pause' veya 'resume' olmalı." }, { status: 400 });
    if (variant && !VARIANTS.includes(variant)) return NextResponse.json({ error: "geçersiz variant." }, { status: 400 });

    const existing = await prisma.xrayPoolGenerationControl.findUnique({ where: { id: "singleton" } });
    const currentActive = new Set((existing?.activeVariants as unknown as string[] | undefined) ?? ["genel"]);

    let nextPaused = existing?.paused ?? true;
    if (action === "resume") {
      nextPaused = false;
      if (variant) currentActive.add(variant);
    } else {
      if (variant) currentActive.delete(variant);
      else nextPaused = true;
    }

    const control = await prisma.xrayPoolGenerationControl.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", paused: nextPaused, activeVariants: Array.from(currentActive) },
      update: { paused: nextPaused, activeVariants: Array.from(currentActive) },
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
