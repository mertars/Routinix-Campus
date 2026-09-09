import { NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getAgenda } from "@/lib/server/agenda/agenda";

export const dynamic = "force-dynamic";

// GET /api/admin/agenda — "bugün / bu hafta / bu ay ne bekliyor" listesi.
// Tek uç nokta iki yüzeyi besler: Genel Bakış'taki Gündem paneli ve yan
// menü adalarındaki bekleyen-iş rozetleri.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    return NextResponse.json(await getAgenda(session.institutionId));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("agenda_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/agenda", handleGet);
