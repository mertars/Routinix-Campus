import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH { prompt?, correctAnswer?, solution?, checks? } — havuz
// tarayıcısından tek bir soruyu elle düzenlemek için. kazanımId/subtopicId/
// order KASITLI OLARAK burada değiştirilemez — bunlar round'un kilitli
// blueprint'ine bağlı (bkz. xray-generate-question-pool.ts), üzerine
// yazılırsa turlar arası tutarlılık bozulur. Sadece içerik (soru metni/
// cevap/çözüm/tanı yorumu) düzenlenebilir.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePlatformSession();
    const { id } = params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz gövde." }, { status: 400 });

    const data: Record<string, string> = {};
    for (const [bodyKey, dbField] of [
      ["prompt", "prompt"],
      ["correctAnswer", "correctAnswer"],
      ["solution", "solution"],
      ["checks", "checks"],
    ] as const) {
      const value = body[bodyKey];
      if (value === undefined) continue;
      if (typeof value !== "string" || !value.trim()) return NextResponse.json({ error: `${bodyKey} boş olamaz.` }, { status: 400 });
      data[dbField] = value.trim();
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

    const existing = await prisma.xrayPracticeQuestion.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });

    const updated = await prisma.xrayPracticeQuestion.update({ where: { id }, data });
    logger.info("xray_pool_question_manually_edited", { questionId: id, testId: existing.testId, order: existing.order, fields: Object.keys(data) });
    return NextResponse.json({ question: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_pool_question_edit_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/platform/xray-pool-questions/[id]", handlePatch);
