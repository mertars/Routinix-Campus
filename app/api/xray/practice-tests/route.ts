import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-tests?subject=Matematik — Test 1 (Konu Bilgisi)
// için soru havuzu bulunan KONULARI (subtopicId bazlı) döner. Faz G:
// öğrenci artık belirli bir testId SEÇMİYOR — bir konu seçtiğinde sistem
// o konunun TÜM havuzundan (onlarca yüklemenin toplamı) rastgele bir test
// derler (bkz. lib/server/xray/practice-pool.ts), bu yüzden liste artık
// testId değil subtopicId bazında gruplanıyor.
async function handleGet(request: NextRequest) {
  try {
    await requireSession();

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { subject },
      select: { subtopicId: true, kazanimId: true },
    });

    const byTopic = new Map<string, { questionCount: number; kazanimIds: Set<string> }>();
    for (const q of questions) {
      const entry = byTopic.get(q.subtopicId) ?? { questionCount: 0, kazanimIds: new Set<string>() };
      entry.questionCount++;
      entry.kazanimIds.add(q.kazanimId);
      byTopic.set(q.subtopicId, entry);
    }

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const topics = [...byTopic.entries()]
      .map(([subtopicId, stats]) => ({
        subtopicId,
        subtopicName: subtopicNameById.get(subtopicId) ?? subtopicId,
        questionCount: stats.questionCount,
        kazanimCount: stats.kazanimIds.size,
      }))
      .sort((a, b) => a.subtopicName.localeCompare(b.subtopicName, "tr"));

    return NextResponse.json({ topics });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_tests_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-tests", handleGet);
