import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/practice-topics?subject=Matematik — Test 1 (Konu Bilgisi)
// için soru havuzunda GERÇEKTEN içerik bulunan alt konuları döner. Sabit
// bir konu listesi yerine veri odaklı — soru havuzu (AI ile) büyüdükçe
// otomatik genişler, kod değişmez.
async function handleGet(request: NextRequest) {
  try {
    await requireSession();

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const grouped = await prisma.xrayPracticeQuestion.groupBy({ by: ["subtopicId"], where: { subject }, _count: { _all: true } });

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const subtopics = grouped
      .map((g) => ({ subtopicId: g.subtopicId, name: subtopicNameById.get(g.subtopicId) ?? g.subtopicId, questionCount: g._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    return NextResponse.json({ subtopics });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_topics_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/practice-topics", handleGet);
