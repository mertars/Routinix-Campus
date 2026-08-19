import { NextRequest, NextResponse } from "next/server";
import { getBatchStatus } from "@/lib/server/sms/notification-service";
import { withApiLogging } from "@/lib/logger";

// GET /api/notifications/:batchId
// Bir toplu gönderim grubunun PENDING/SENT/FAILED sayaçlarını döner.
async function handleGet(_request: NextRequest, { params }: { params: { batchId: string } }) {
  try {
    const status = await getBatchStatus(params.batchId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata" }, { status: 404 });
  }
}

export const GET = withApiLogging("GET /api/notifications/[batchId]", handleGet);
