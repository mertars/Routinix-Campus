import { NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getSetupStatus } from "@/lib/server/setup/setup-status";

export const dynamic = "force-dynamic";

// GET /api/admin/setup-status — kurulum sihirbazının beslendiği durum.
// Her çağrıda veritabanından hesaplanır (bkz. setup-status.ts'teki
// "bayrak tutulmaz" gerekçesi).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    return NextResponse.json(await getSetupStatus(session.institutionId));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("setup_status_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/setup-status", handleGet);
