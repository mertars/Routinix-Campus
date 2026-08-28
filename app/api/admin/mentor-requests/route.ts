import { NextResponse } from "next/server";
import { listMentorRequestsForInstitution } from "@/lib/server/admin/alumni";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: kurumdaki TÜM mentorluk taleplerini (bekleyen + geçmiş) listeler —
// mezunun kendisi sisteme giriş yapmadığından onay/red yönetici üzerinden
// yürür (bkz. lib/server/admin/alumni.ts > MentorRequest'teki not).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const requests = await listMentorRequestsForInstitution(session.institutionId);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_mentor_requests_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/mentor-requests", handleGet);
