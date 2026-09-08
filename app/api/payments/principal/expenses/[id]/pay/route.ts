import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";

export const dynamic = "force-dynamic";

// POST /api/payments/principal/expenses/[id]/pay — { accountId, paidAt? }
// Bekleyen bir gideri "ödendi" işaretler; seçilen kasa/banka hesabının
// bakiyesinden bu andan itibaren düşülür (bakiye canlı hesaplanıyor, bkz.
// accounts/route.ts).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const expense = await prisma.expense.findUnique({ where: { id: params.id }, select: { institutionId: true, status: true } });
    if (!expense) return NextResponse.json({ error: "Gider bulunamadı." }, { status: 404 });
    requireInstitution(session, expense.institutionId);
    if (expense.status === "PAID") return NextResponse.json({ error: "Bu gider zaten ödenmiş." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const accountId = body?.accountId as string | undefined;
    const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
    if (!accountId) return NextResponse.json({ error: "accountId zorunludur." }, { status: 400 });
    if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: "paidAt geçerli bir tarih olmalı." }, { status: 400 });

    const account = await prisma.paymentAccount.findUnique({ where: { id: accountId }, select: { institutionId: true } });
    if (!account || account.institutionId !== session.institutionId) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: { status: "PAID", accountId, paidAt },
    });
    await recordPaymentAudit({
      session,
      action: "EXPENSE_PAID",
      targetType: "Expense",
      targetId: params.id,
      amount: Number(updated.amount),
      summary: `${updated.title}${updated.vendorName ? ` · ${updated.vendorName}` : ""}`,
      metadata: { accountId, categoryId: updated.categoryId },
    });

    return NextResponse.json({ expense: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("expense_pay_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/payments/principal/expenses/[id]/pay", handlePost);
