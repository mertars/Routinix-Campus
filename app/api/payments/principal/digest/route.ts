import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { buildDigest } from "@/lib/server/payments/daily-digest";

export const dynamic = "force-dynamic";

// GET — bugünün özeti + uyarılar.
//
// Aynı hesap hem panelin üstündeki uyarı şeridini hem de günlük cron
// bildirimini besler; iki yerde ayrı yazılsaydı ekranda görünen ile
// bildirimde yazan farklılaşabilirdi.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const institution = await prisma.institution.findUnique({
      where: { id: session.institutionId },
      select: { name: true },
    });
    const digest = await buildDigest(session.institutionId, institution?.name ?? "Kurum");
    return NextResponse.json(digest);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("digest_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/digest", handleGet);
