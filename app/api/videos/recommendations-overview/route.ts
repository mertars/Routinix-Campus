import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { getVideoRecommendationsOverview } from "@/lib/server/xray/video-recommendations-overview";

export const dynamic = "force-dynamic";

// GET /api/videos/recommendations-overview — Video Ders Merkezi panelinin
// KENDİSİNDE (herhangi bir videoyu tek tek açmadan) "hangi videoyu kime
// atamalıyım" sorusuna cevap veren kurum geneli özet (bkz.
// video-recommendations-overview.ts'teki gerekçe).
async function handleGet(_request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const items = await getVideoRecommendationsOverview(session.institutionId);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_recommendations_overview_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Öneriler yüklenemedi." }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/videos/recommendations-overview", handleGet);
