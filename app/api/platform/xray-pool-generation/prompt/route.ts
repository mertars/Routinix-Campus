import { NextRequest, NextResponse } from "next/server";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { flattenTopics, flattenCurriculum } from "@/lib/server/xray/question-generation/curriculum-flatten";
import { SYSTEM_PROMPT_GENEL, buildGenelRound1UserPrompt, SYSTEM_PROMPT_ALT_KONU, buildAltKonuRound1UserPrompt } from "@/lib/server/xray/question-generation/prompt";

export const dynamic = "force-dynamic";

const SUBJECT = "Matematik";

// GET ?variant=genel|alt_konu&unitId=... — worker'ın (scripts/xray-
// generate-question-pool.ts) GERÇEKTEN kullandığı prompt fonksiyonlarını
// BİREBİR çağırıp döner (kopya/özetlenmiş metin DEĞİL) — panelde "Prompt'u
// Gör" ile ne gönderildiğini denetleyebilmek için TEK doğru kaynak. Sadece
// round 1'in prompt'u gösterilir (round 2+ aynı yapıyı + kilitli blueprint'i
// enjekte eder, blueprint henüz üretilmediyse gösterilecek somut bir şey yok).
async function handleGet(request: NextRequest) {
  try {
    await requirePlatformSession();
    const variant = request.nextUrl.searchParams.get("variant");
    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) return NextResponse.json({ error: "unitId zorunludur." }, { status: 400 });

    if (variant === "genel") {
      const topic = flattenTopics(SUBJECT).find((t) => t.topicId === unitId);
      if (!topic) return NextResponse.json({ error: "Konu bulunamadı." }, { status: 404 });
      return NextResponse.json({ systemPrompt: SYSTEM_PROMPT_GENEL, userPrompt: buildGenelRound1UserPrompt(topic) });
    }
    if (variant === "alt_konu") {
      const subtopic = flattenCurriculum(SUBJECT).find((s) => s.subtopicId === unitId);
      if (!subtopic) return NextResponse.json({ error: "Alt konu bulunamadı." }, { status: 404 });
      return NextResponse.json({ systemPrompt: SYSTEM_PROMPT_ALT_KONU, userPrompt: buildAltKonuRound1UserPrompt(subtopic) });
    }
    return NextResponse.json({ error: "Bu variant için prompt henüz tasarlanmadı." }, { status: 404 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_pool_generation_prompt_view_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/xray-pool-generation/prompt", handleGet);
