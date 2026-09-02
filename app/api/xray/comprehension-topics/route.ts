import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/comprehension-topics?subject=Matematik — Test 2 ("Ne Kadar
// Anlamış") havuzunda GERÇEKTEN soru bulunan konuları döner — yöneticinin
// atama ekranındaki konu seçici, sabit liste yerine veri odaklı (bkz.
// practice-topics'teki AYNI desen).
//
// Kullanıcı geri bildirimi (2026-09-03) — bu havuz (XrayComprehensionQuestion)
// şu an BOŞ, hiçbir yerde içine soru YAZAN bir kod yok. Planlanan kaynak:
// "yeterlilik" (20 soru, zor/kapsamlı) — ama bu KİLİTLİ/ÇOKTAN SEÇMELİ bir
// FORMAT (her seçenek kendi `diagnosis` metnini taşır, bkz.
// XrayComprehensionOption), scripts/xray-generate-question-pool.ts'teki
// worker İSE açık uçlu (tek doğru cevap + serbest metin çözüm) formata göre
// tasarlandı — o worker'a "yeterlilik" eklemek YANLIŞ formatta soru
// üretirdi, o yüzden oradan bilerek kaldırıldı (bkz. o dosyanın notu).
// Gerçek üretim AYRI bir prompt+worker (ya da elle/CSV yükleme) gerektirir.
// Bu route'un (ve tüm "Ne Kadar Anlamış" atama/gösterme akışının) kendisi
// EK KOD GEREKMEDEN hazır — sorular bu tabloya nasıl düşerse düşsün
// (worker, elle upload, ne olursa) otomatik olarak burada görünüp
// atanabilir hale gelir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const grouped = await prisma.xrayComprehensionQuestion.groupBy({ by: ["subtopicId"], where: { subject }, _count: { _all: true } });

    // Faz K: SADECE lise (9-12. sınıf) konuları — bkz. XRAY_MIN_GRADE yorumu.
    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      if (topic.grade < XRAY_MIN_GRADE) continue;
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const subtopics = grouped
      .filter((g) => subtopicNameById.has(g.subtopicId))
      .map((g) => ({ subtopicId: g.subtopicId, name: subtopicNameById.get(g.subtopicId) ?? g.subtopicId, questionCount: g._count._all }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));

    return NextResponse.json({ subtopics });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_topics_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/comprehension-topics", handleGet);
