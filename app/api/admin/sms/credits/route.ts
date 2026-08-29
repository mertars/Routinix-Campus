import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/sms/credits — Toplu SMS ekranındaki "Kalan Kontür" göstergesi.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const institution = await prisma.institution.findUnique({
      where: { id: session.institutionId },
      select: { smsCredits: true },
    });
    return NextResponse.json({ smsCredits: institution?.smsCredits ?? 0 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("sms_credits_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/sms/credits", handleGet);
