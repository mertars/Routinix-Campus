import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-tests?subject=Matematik&variant=genel — Test 1
// (Konu Bilgisi) için soru havuzu bulunan KONULARI (subtopicId bazlı)
// döner. Faz G: öğrenci artık belirli bir testId SEÇMİYOR — bir konu
// seçtiğinde sistem o konunun TÜM havuzundan (onlarca yüklemenin toplamı)
// rastgele bir test derler (bkz. lib/server/xray/practice-pool.ts), bu
// yüzden liste artık testId değil subtopicId bazında gruplanıyor.
//
// Faz Z6: variant zorunlu değil (varsayılan "genel", geriye dönük uyumlu)
// ama HER ZAMAN filtreye dahil edilir — aksi halde "genel" (tema geneli,
// 30 soru) ve "alt_konu" (tek alt konu, 10 soru) havuzları AYNI subtopicId
// altında karışırdı (ikisi de XrayPracticeQuestion.subtopicId'ye yazıyor).
async function handleGet(request: NextRequest) {
  try {
    await requireSession();

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });
    const variant = request.nextUrl.searchParams.get("variant") || "genel";

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { subject, variant },
      select: { subtopicId: true, kazanimId: true },
    });

    const byTopic = new Map<string, { questionCount: number; kazanimIds: Set<string> }>();
    for (const q of questions) {
      const entry = byTopic.get(q.subtopicId) ?? { questionCount: 0, kazanimIds: new Set<string>() };
      entry.questionCount++;
      entry.kazanimIds.add(q.kazanimId);
      byTopic.set(q.subtopicId, entry);
    }

    // Faz K: SADECE lise (9-12. sınıf) konuları — bkz. XRAY_MIN_GRADE yorumu.
    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      if (topic.grade < XRAY_MIN_GRADE) continue;
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const topics = [...byTopic.entries()]
      .filter(([subtopicId]) => subtopicNameById.has(subtopicId))
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
