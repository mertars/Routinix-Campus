import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/budget?year=2026
// Bir yılın 12 ayı için PLAN ve GERÇEKLEŞEN'i yan yana döner. Gerçekleşen
// veriler ayrıca hesaplanmaz — mevcut Payment/Expense kayıtlarından
// türetilir, yani bütçe ekranı ile kontrol paneli ASLA çelişemez.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const institutionId = session.institutionId;

    const yearParam = Number(request.nextUrl.searchParams.get("year"));
    const year = Number.isInteger(yearParam) && yearParam >= 2020 && yearParam <= 2100 ? yearParam : new Date().getFullYear();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);

    const [lines, categories, payments, expenses] = await Promise.all([
      prisma.budgetLine.findMany({ where: { institutionId, year } }),
      prisma.expenseCategory.findMany({ where: { institutionId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.payment.findMany({
        where: { institutionId, status: "COMPLETED", paidAt: { gte: yearStart, lt: yearEnd } },
        select: { amount: true, paidAt: true },
      }),
      prisma.expense.findMany({
        where: { institutionId, status: "PAID", paidAt: { gte: yearStart, lt: yearEnd } },
        select: { amount: true, paidAt: true, categoryId: true },
      }),
    ]);

    // Aylık gerçekleşen gelir/gider + kategori kırılımı.
    const actualIncome = Array.from({ length: 12 }, () => 0);
    const actualExpense = Array.from({ length: 12 }, () => 0);
    const actualExpenseByCat = new Map<string, number[]>();
    for (const p of payments) actualIncome[p.paidAt.getMonth()] += Number(p.amount);
    for (const e of expenses) {
      if (!e.paidAt) continue;
      const m = e.paidAt.getMonth();
      actualExpense[m] += Number(e.amount);
      const arr = actualExpenseByCat.get(e.categoryId) ?? Array.from({ length: 12 }, () => 0);
      arr[m] += Number(e.amount);
      actualExpenseByCat.set(e.categoryId, arr);
    }

    // Planlar.
    const plannedIncome = Array.from({ length: 12 }, () => 0);
    const plannedExpenseByCat = new Map<string, number[]>();
    for (const l of lines) {
      const m = l.month - 1;
      if (m < 0 || m > 11) continue;
      if (l.kind === "INCOME") {
        plannedIncome[m] += Number(l.plannedAmount);
      } else if (l.categoryId) {
        const arr = plannedExpenseByCat.get(l.categoryId) ?? Array.from({ length: 12 }, () => 0);
        arr[m] += Number(l.plannedAmount);
        plannedExpenseByCat.set(l.categoryId, arr);
      }
    }
    const plannedExpense = Array.from({ length: 12 }, (_, m) => [...plannedExpenseByCat.values()].reduce((s, arr) => s + arr[m], 0));

    return NextResponse.json({
      year,
      months: Array.from({ length: 12 }, (_, m) => ({
        month: m + 1,
        plannedIncome: plannedIncome[m],
        actualIncome: actualIncome[m],
        plannedExpense: plannedExpense[m],
        actualExpense: actualExpense[m],
      })),
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        planned: plannedExpenseByCat.get(c.id) ?? Array.from({ length: 12 }, () => 0),
        actual: actualExpenseByCat.get(c.id) ?? Array.from({ length: 12 }, () => 0),
      })),
      totals: {
        plannedIncome: plannedIncome.reduce((s, v) => s + v, 0),
        actualIncome: actualIncome.reduce((s, v) => s + v, 0),
        plannedExpense: plannedExpense.reduce((s, v) => s + v, 0),
        actualExpense: actualExpense.reduce((s, v) => s + v, 0),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("budget_get_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — bütçe satırı yaz/güncelle.
// Tekil: { year, month, kind, categoryId?, plannedAmount }
// Sihirbaz: { year, kind, categoryId?, plannedAmount, applyAllMonths: true }
//   -> 12 ayın TAMAMINA aynı tutarı yazar (aylık sabit kalemler — kira,
//      maaş — için tek tek girmek anlamsız).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const year = Number(body?.year);
    const kind = body?.kind as "INCOME" | "EXPENSE" | undefined;
    const categoryId = (body?.categoryId as string | undefined) || null;
    const plannedAmount = Number(body?.plannedAmount);
    const applyAllMonths = body?.applyAllMonths === true;
    const month = body?.month != null ? Number(body.month) : null;

    if (!Number.isInteger(year) || year < 2020 || year > 2100) return NextResponse.json({ error: "Geçersiz yıl." }, { status: 400 });
    if (kind !== "INCOME" && kind !== "EXPENSE") return NextResponse.json({ error: "kind INCOME veya EXPENSE olmalı." }, { status: 400 });
    if (!Number.isFinite(plannedAmount) || plannedAmount < 0) return NextResponse.json({ error: "plannedAmount 0 veya daha büyük olmalı." }, { status: 400 });
    if (kind === "EXPENSE" && !categoryId) return NextResponse.json({ error: "Gider bütçesi için kategori zorunludur." }, { status: 400 });
    if (!applyAllMonths && (!Number.isInteger(month) || (month as number) < 1 || (month as number) > 12)) {
      return NextResponse.json({ error: "Geçersiz ay." }, { status: 400 });
    }

    if (categoryId) {
      const cat = await prisma.expenseCategory.findUnique({ where: { id: categoryId }, select: { institutionId: true } });
      if (!cat || cat.institutionId !== session.institutionId) return NextResponse.json({ error: "Kategori bulunamadı." }, { status: 404 });
    }

    const months = applyAllMonths ? Array.from({ length: 12 }, (_, i) => i + 1) : [month as number];
    for (const m of months) {
      // ⚠️ upsert KULLANILMIYOR: bileşik unique (institutionId, year, month,
      // kind, categoryId) GELİR satırlarında işe yaramaz — Postgres'te
      // NULL != NULL olduğu için categoryId null olan satırlar birbirinin
      // kopyası sayılmaz ve unique kısıtı devreye girmez. upsert bu yüzden
      // mevcut geliri bulamayıp HER kayıtta yeni satır açar, bütçe iki
      // katına çıkardı. Bu yüzden önce aranıp sonra yazılıyor.
      const existing = await prisma.budgetLine.findFirst({
        where: { institutionId: session.institutionId, year, month: m, kind, categoryId },
        select: { id: true },
      });
      if (existing) {
        await prisma.budgetLine.update({ where: { id: existing.id }, data: { plannedAmount } });
      } else {
        await prisma.budgetLine.create({ data: { institutionId: session.institutionId, year, month: m, kind, categoryId, plannedAmount } });
      }
    }

    return NextResponse.json({ updatedMonths: months.length }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("budget_save_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/budget", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/budget", handlePost);
