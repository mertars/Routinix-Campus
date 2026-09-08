import { NextRequest, NextResponse } from "next/server";
import type { PaymentAccountType } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/accounts — kurumun kasa/banka hesapları ve
// GÜNCEL bakiyeleri. Bakiye formülü (gelir − ödenmiş gider ± virman)
// dashboard ile ORTAK bir yardımcıda (bkz. computeAccountBalances).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");
    const accounts = await computeAccountBalances(session.institutionId);
    return NextResponse.json({ accounts });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("payment_accounts_list_failed", error);
  }
}

// POST /api/payments/principal/accounts — yeni kasa/banka hesabı ekle.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const name = (body?.name as string | undefined)?.trim();
    const type = body?.type as PaymentAccountType | undefined;
    if (!name) return NextResponse.json({ error: "name zorunludur." }, { status: 400 });
    if (type !== "CASH" && type !== "BANK") return NextResponse.json({ error: "type CASH veya BANK olmalı." }, { status: 400 });

    const account = await prisma.paymentAccount.create({
      data: { institutionId: session.institutionId, name, type },
    });
    return NextResponse.json({ account: { ...account, balance: 0 } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("payment_account_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/accounts", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/accounts", handlePost);
