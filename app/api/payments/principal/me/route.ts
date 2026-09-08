import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import type { PaymentRole } from "@/lib/payments/payment-roles";
import { apiFailure } from "@/lib/server/api-failure";

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
    return apiFailure("payment_me_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/me", handleGet);
