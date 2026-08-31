import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-tests?subject=Matematik&variant=genel — Test 1
// (Konu Bilgisi) için soru havuzu bulunan BİRİMLERİ döner. Faz G: öğrenci
// artık belirli bir testId SEÇMİYOR — bir birim seçtiğinde sistem o
// birimin TÜM havuzundan rastgele bir test derler (bkz.
// lib/server/xray/practice-pool.ts).
//
// Faz Z16 — kullanıcı geri bildirimi ile düzeltildi: "genel" (30 soru,
// TEMANIN TÜMÜNÜ kapsar) turları TÜM alt konulara dağıldığı için, bu liste
// eskiden yanlışlıkla ALT KONU bazında gruplanıyordu — bir alt konu
// seçilince o alt konuya düşen PAY (örn. 8 soru) atanıyordu, 30 soruluk
// bütün test DEĞİL. Artık "genel"/"yeterlilik" için gruplama TEMA (topicId)
// bazında, "alt_konu" için (değişmeden) SUBTOPIC bazında yapılıyor. Yanıt
// alanı adı geriye dönük uyumluluk için "subtopicId"/"subtopicName" olarak
// KALDI ama "genel" için SEMANTİĞİ topicId/topicName'dir (bkz.
// lib/server/xray/unit-label.ts — aynı ikili anlam POST tarafında da
// çözülür).
async function handleGet(request: NextRequest) {
  try {
    await requireSession();

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });
    const variant = request.nextUrl.searchParams.get("variant") || "genel";
    const groupByTopic = variant !== "alt_konu";

    const questions = await prisma.xrayPracticeQuestion.findMany({
      where: { subject, variant },
      select: { subtopicId: true, kazanimId: true },
    });

    // Faz K: SADECE lise (9-12. sınıf) konuları — bkz. XRAY_MIN_GRADE yorumu.
    const subtopicMetaById = new Map<string, { subtopicName: string; topicId: string; topicName: string; grade: number }>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      if (topic.grade < XRAY_MIN_GRADE) continue;
      for (const sub of topic.subtopics) subtopicMetaById.set(sub.id, { subtopicName: sub.name, topicId: topic.id, topicName: topic.name, grade: topic.grade });
    }

    const byUnit = new Map<string, { unitName: string; topicName: string; grade: number; questionCount: number; kazanimIds: Set<string> }>();
    for (const q of questions) {
      const meta = subtopicMetaById.get(q.subtopicId);
      if (!meta) continue;
      const unitId = groupByTopic ? meta.topicId : q.subtopicId;
      const entry = byUnit.get(unitId) ?? { unitName: groupByTopic ? meta.topicName : meta.subtopicName, topicName: meta.topicName, grade: meta.grade, questionCount: 0, kazanimIds: new Set<string>() };
      entry.questionCount++;
      entry.kazanimIds.add(q.kazanimId);
      byUnit.set(unitId, entry);
    }

    const topics = [...byUnit.entries()]
      .map(([unitId, stats]) => ({
        subtopicId: unitId,
        subtopicName: stats.unitName,
        topicName: stats.topicName,
        grade: stats.grade,
        questionCount: stats.questionCount,
        kazanimCount: stats.kazanimIds.size,
      }))
      .sort((a, b) => a.grade - b.grade || a.subtopicName.localeCompare(b.subtopicName, "tr"));

    return NextResponse.json({ topics });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_tests_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-tests", handleGet);
