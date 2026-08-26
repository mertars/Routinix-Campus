import { NextRequest, NextResponse } from "next/server";
import { getBatchStatus } from "@/lib/server/sms/notification-service";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";

// GET /api/notifications/:batchId
// Bir toplu gönderim grubunun PENDING/SENT/FAILED sayaçlarını döner.
// Sadece aynı kurumdaki bir yönetici erişebilir — getBatchStatus batchId'nin
// çağıranın kurumuna ait olduğunu doğrular (bkz. notification-service.ts).
async function handleGet(_request: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const status = await getBatchStatus(params.batchId, session.institutionId);
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata" }, { status: 404 });
  }
}

export const GET = withApiLogging("GET /api/notifications/[batchId]", handleGet);
