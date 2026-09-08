import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/expenses?status=PENDING|PAID
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const status = request.nextUrl.searchParams.get("status");
    const expenses = await prisma.expense.findMany({
      where: {
        institutionId: session.institutionId,
        ...(status === "PENDING" || status === "PAID" ? { status } : {}),
      },
      include: { category: { select: { name: true } }, account: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });

    const now = new Date();
    return NextResponse.json({
      expenses: expenses.map((e) => ({
        id: e.id,
        title: e.title,
        vendorName: e.vendorName,
        categoryName: e.category.name,
        accountName: e.account?.name ?? null,
        amount: Number(e.amount),
        status: e.status,
        dueDate: e.dueDate?.toISOString() ?? null,
        paidAt: e.paidAt?.toISOString() ?? null,
        isOverdue: e.status === "PENDING" && e.dueDate != null && e.dueDate < now,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("expenses_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { categoryId, title, amount, vendorName?, dueDate?, note?,
//          payNow?: boolean, accountId? }
// payNow=true ise gider ANINDA ödenmiş sayılır (accountId zorunlu) ve o
// hesabın bakiyesinden düşer; aksi halde PENDING olarak kaydedilir ve
// bakiyeyi etkilemez (bkz. schema > ExpenseStatus gerekçesi).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const categoryId = body?.categoryId as string | undefined;
    const title = (body?.title as string | undefined)?.trim();
    const amount = Number(body?.amount);
    const vendorName = (body?.vendorName as string | undefined)?.trim() || null;
    const note = (body?.note as string | undefined)?.trim() || null;
    const payNow = body?.payNow === true;
    const accountId = (body?.accountId as string | undefined) || null;
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;

    if (!categoryId) return NextResponse.json({ error: "categoryId zorunludur." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "title zorunludur." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif bir sayı olmalı." }, { status: 400 });
    if (dueDate && Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "dueDate geçerli bir tarih olmalı." }, { status: 400 });

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId }, select: { institutionId: true } });
    if (!category || category.institutionId !== session.institutionId) return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });

    if (payNow) {
      if (!accountId) return NextResponse.json({ error: "Ödenmiş gider için accountId zorunludur." }, { status: 400 });
      const account = await prisma.paymentAccount.findUnique({ where: { id: accountId }, select: { institutionId: true } });
      if (!account || account.institutionId !== session.institutionId) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        institutionId: session.institutionId,
        categoryId,
        title,
        vendorName,
        amount,
        note,
        dueDate,
        status: payNow ? "PAID" : "PENDING",
        accountId: payNow ? accountId : null,
        paidAt: payNow ? new Date() : null,
        recordedByAdminId: session.sub,
      },
    });
    return NextResponse.json({ expense }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("expense_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/expenses", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/expenses", handlePost);
