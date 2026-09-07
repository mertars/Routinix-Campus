import { NextRequest, NextResponse } from "next/server";
import type { PaymentAccountType } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/accounts — kurumun kasa/banka hesapları,
// her biri için GÜNCEL bakiye = tahsil edilen gelir − ÖDENMİŞ gider (ayrı
// bir cache alanı YOK — az sayıda hesap/işlem için bakiye sapması riskine
// girmektense her istekte toplanıyor, bkz. plan dosyasındaki gerekçe).
// Bekleyen (PENDING) giderler bakiyeyi ETKİLEMEZ, sadece ödendiklerinde
// düşer (bkz. prisma/schema.prisma > ExpenseStatus).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const [accounts, incomes, paidExpenses] = await Promise.all([
      prisma.paymentAccount.findMany({
        where: { institutionId: session.institutionId, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.payment.groupBy({
        by: ["accountId"],
        where: { institutionId: session.institutionId, status: "COMPLETED" },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ["accountId"],
        where: { institutionId: session.institutionId, status: "PAID", accountId: { not: null } },
        _sum: { amount: true },
      }),
    ]);
    const incomeByAccount = new Map(incomes.map((b) => [b.accountId, Number(b._sum.amount ?? 0)]));
    const expenseByAccount = new Map(paidExpenses.map((b) => [b.accountId as string, Number(b._sum.amount ?? 0)]));

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: (incomeByAccount.get(a.id) ?? 0) - (expenseByAccount.get(a.id) ?? 0),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_accounts_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/payments/principal/accounts — yeni kasa/banka hesabı ekle.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

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
    logger.error("payment_account_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/accounts", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/accounts", handlePost);
