import { NextResponse } from "next/server";
import { listMentorRequestsForInstitution } from "@/lib/server/admin/alumni";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

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
    return apiFailure("admin_mentor_requests_list_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/mentor-requests", handleGet);
