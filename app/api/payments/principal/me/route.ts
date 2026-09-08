import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import type { PaymentRole } from "@/lib/payments/payment-roles";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/me — oturumdaki yöneticinin ödeme yetkisi.
//
// Panel, gösterilecek sekmeleri buna göre süzer. Bu YALNIZCA arayüz
// kolaylığıdır; asıl koruma her route'un kendi requirePaymentRole
// çağrısıdır — sekmeyi gizlemek uç noktayı korumaz.
//
// requirePaymentRole KULLANILMAZ: yetkisi NONE olan biri de kendi
// yetkisini öğrenebilmeli, aksi halde panel "yükleniyor"da kalırdı.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const admin = await prisma.admin.findUnique({
      where: { id: session.sub },
      select: { paymentRole: true, institutionId: true },
    });
    const paymentRole: PaymentRole =
      admin && admin.institutionId === session.institutionId ? (admin.paymentRole as PaymentRole) : "NONE";

    return NextResponse.json({ paymentRole });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_me_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/me", handleGet);
