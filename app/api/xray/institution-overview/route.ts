import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getInstitutionOverview } from "@/lib/server/xray/institution-overview";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/institution-overview?subject= — "Genel Bakış" ekranı: kurum
// geneli → sınıf seviyesi → şube şeklinde 3 katmanlı drill-down için TÜM
// ağacı tek istekte döner (bkz. lib/server/xray/institution-overview.ts).
// SADECE principal — öğretmen kendi şubesi dışındaki verileri görmemeli
// (institution-insights ile AYNI yetki deseni).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const data = await getInstitutionOverview(session.institutionId, subject);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_institution_overview_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/institution-overview", handleGet);
