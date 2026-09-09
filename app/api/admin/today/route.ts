import { NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { getTodayTasks } from "@/lib/server/today/today-tasks";

export const dynamic = "force-dynamic";

// GET /api/admin/today — "bugün ne yapmam lazım" listesi.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    return NextResponse.json(await getTodayTasks(session.institutionId));
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("today_tasks_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/today", handleGet);
