import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { monthKey } from "@/lib/server/payments/cashflow";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// dayOfMonth üst sınırı 28: 29/30/31 her ayda yok, vade hesabı Şubat'ta
// bozulurdu.
const MAX_DAY = 28;

// GET — şablonlar + bu ay için üretilmemiş olanlar.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const now = new Date();
    const current = monthKey(now);

    const rules = await prisma.recurringExpense.findMany({
      where: { institutionId: session.institutionId },
      orderBy: [{ isActive: "desc" }, { dayOfMonth: "asc" }],
      include: { category: { select: { name: true } } },
    });

    return NextResponse.json({
      currentMonth: current,
      templates: rules.map((r) => ({
        id: r.id,
        title: r.title,
        categoryId: r.categoryId,
        categoryName: r.category.name,
        vendorName: r.vendorName,
        amount: Number(r.amount),
        dayOfMonth: r.dayOfMonth,
        isActive: r.isActive,
        lastGeneratedMonth: r.lastGeneratedMonth,
        // Bu ay için gider üretilmiş mi — arayüz "hazırla" düğmesini
        // buna göre gösterir.
        generatedThisMonth: r.lastGeneratedMonth === current,
      })),
      pendingCount: rules.filter((r) => r.isActive && r.lastGeneratedMonth !== current).length,
      monthlyTotal: rules.filter((r) => r.isActive).reduce((sum, r) => sum + Number(r.amount), 0),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("recurring_expenses_list_failed", error);
  }
}

// POST — { categoryId, title, amount, dayOfMonth, vendorName? }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const categoryId = body?.categoryId as string | undefined;
    const title = (body?.title as string | undefined)?.trim();
    const amount = Number(body?.amount);
    const dayOfMonth = Number(body?.dayOfMonth ?? 1);
    const vendorName = (body?.vendorName as string | undefined)?.trim() || null;

    if (!categoryId) return NextResponse.json({ error: "categoryId zorunludur." }, { status: 400 });
    if (!title) return NextResponse.json({ error: "title zorunludur." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif bir sayı olmalı." }, { status: 400 });
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > MAX_DAY) {
      return NextResponse.json({ error: `Ödeme günü 1 ile ${MAX_DAY} arasında olmalı.` }, { status: 400 });
    }

    const category = await prisma.expenseCategory.findUnique({ where: { id: categoryId }, select: { institutionId: true } });
    if (!category || category.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
    }

    const created = await prisma.recurringExpense.create({
      data: { institutionId: session.institutionId, categoryId, title, amount, dayOfMonth, vendorName },
    });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("recurring_expense_create_failed", error);
  }
}

// PATCH — { id, isActive?, amount?, dayOfMonth? }  /  DELETE için isActive=false yeterli:
// şablon silinirse ondan üretilmiş giderlerin nereden geldiği kaybolurdu.
async function handlePatch(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

    const rule = await prisma.recurringExpense.findUnique({ where: { id }, select: { institutionId: true } });
    if (!rule || rule.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şablon bulunamadı." }, { status: 404 });
    }

    const data: { isActive?: boolean; amount?: number; dayOfMonth?: number } = {};
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (body.amount != null) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif olmalı." }, { status: 400 });
      data.amount = amount;
    }
    if (body.dayOfMonth != null) {
      const day = Number(body.dayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > MAX_DAY) {
        return NextResponse.json({ error: `Ödeme günü 1 ile ${MAX_DAY} arasında olmalı.` }, { status: 400 });
      }
      data.dayOfMonth = day;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });

    await prisma.recurringExpense.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("recurring_expense_update_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/recurring-expenses", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/recurring-expenses", handlePost);
export const PATCH = withApiLogging("PATCH /api/payments/principal/recurring-expenses", handlePatch);
