import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";
import { computePayrollDraft, PAYROLL_CATEGORY } from "@/lib/server/payroll/payroll-service";
import { projectCashflow, computeCollectionRate } from "@/lib/server/payments/cashflow";

export const dynamic = "force-dynamic";

// Düzenli gider ortalaması kaç aylık geçmişten türetilsin. 3 ay: mevsimsel
// dalgalanmayı (kış elektriği) tamamen düzleştirmeyecek kadar kısa, tek bir
// olağandışı faturadan etkilenmeyecek kadar uzun.
const RECURRING_LOOKBACK_MONTHS = 3;
// Tahsilat oranı kaç aylık geçmişe bakarak hesaplansın.
const RATE_LOOKBACK_MONTHS = 6;
const DEFAULT_MONTHS = 6;
const MAX_MONTHS = 12;

// GET /api/payments/principal/cashflow?months=6 — nakit akışı projeksiyonu.
//
// Panelin geri kalanı GEÇMİŞİ raporluyordu; bu uç İLERİYİ tahmin eder ve
// bunu yaparken hâlihazırda kurulmuş her modülü birbirine bağlar:
// kasa bakiyesi + taksit planı + girilmiş giderler + bordro profilleri.
//
// Tahminin üç varsayımı var ve üçü de ekranda AÇIKÇA gösterilir (rakam kara
// kutu olmamalı — bkz. kayıt iptali iade önerisindeki aynı yaklaşım):
//   1) Gelir, geçmiş tahsilat oranıyla düzeltilir.
//   2) Gider = kategori bazında max(girilmiş, düzenli tahmin).
//   3) Vadesi geçmiş birikmiş alacak projeksiyona DAHİL EDİLMEZ.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const requested = Number(request.nextUrl.searchParams.get("months"));
    const monthCount = Number.isFinite(requested) && requested >= 1 ? Math.min(MAX_MONTHS, Math.floor(requested)) : DEFAULT_MONTHS;

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endExclusive = new Date(now.getFullYear(), now.getMonth() + monthCount, 1);
    const rateWindowStart = new Date(now.getFullYear(), now.getMonth() - RATE_LOOKBACK_MONTHS, 1);
    const recurringWindowStart = new Date(now.getFullYear(), now.getMonth() - RECURRING_LOOKBACK_MONTHS, 1);

    const [
      balances,
      futureInstallments,
      pendingExpenses,
      pastInstallments,
      paidExpenses,
      payrollDrafts,
      payrollCategory,
      paidThisMonth,
    ] = await Promise.all([
        computeAccountBalances(session.institutionId),
        prisma.installment.findMany({
          where: {
            institutionId: session.institutionId,
            status: { in: ["PENDING", "PARTIALLY_PAID"] },
            dueDate: { gte: startMonth, lt: endExclusive },
          },
          select: { dueDate: true, amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        }),
        prisma.expense.findMany({
          where: {
            institutionId: session.institutionId,
            status: "PENDING",
            dueDate: { gte: startMonth, lt: endExclusive },
          },
          select: { dueDate: true, amount: true, categoryId: true },
        }),
        // Tahsilat oranı için: vadesi GEÇMİŞ (bu aydan önceki) taksitler.
        prisma.installment.findMany({
          where: {
            institutionId: session.institutionId,
            status: { not: "CANCELLED" },
            dueDate: { gte: rateWindowStart, lt: startMonth },
          },
          select: { amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        }),
        // Düzenli gider ortalaması için: son N ayda ÖDENMİŞ giderler.
        prisma.expense.groupBy({
          by: ["categoryId"],
          where: { institutionId: session.institutionId, status: "PAID", paidAt: { gte: recurringWindowStart, lt: startMonth } },
          _sum: { amount: true },
        }),
        computePayrollDraft(session.institutionId),
        prisma.expenseCategory.findFirst({ where: { institutionId: session.institutionId, name: PAYROLL_CATEGORY }, select: { id: true } }),
        // Bu ay ZATEN ödenmiş giderler — açılış bakiyesinden düşmüş
        // oldukları için ilk ayın tahmininden çıkarılırlar.
        prisma.expense.groupBy({
          by: ["categoryId"],
          where: { institutionId: session.institutionId, status: "PAID", paidAt: { gte: startMonth } },
          _sum: { amount: true },
        }),
      ]);

    const openingBalance = balances.reduce((sum, b) => sum + b.balance, 0);

    const openInstallments = futureInstallments.map((i) => ({
      dueDate: i.dueDate,
      remaining: Number(i.amount) - i.payments.reduce((sum, p) => sum + Number(p.amount), 0),
    }));

    const dueTotal = pastInstallments.reduce((sum, i) => sum + Number(i.amount), 0);
    const collectedTotal = pastInstallments.reduce((sum, i) => sum + i.payments.reduce((s, p) => s + Number(p.amount), 0), 0);
    const collectionRate = computeCollectionRate(dueTotal, collectedTotal);

    const categories = await prisma.expenseCategory.findMany({
      where: { institutionId: session.institutionId },
      select: { id: true, name: true },
    });
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));

    // Bordro kategorisi geçmiş ortalamadan HARİÇ tutulur; onun yerine
    // bordro taslağından (aktif personel × ücret) ileriye dönük tahmin
    // konur — geçmişte bordro hiç ödenmemiş olsa bile gider beklentisi
    // doğru çıksın diye.
    const recurringByCategory = paidExpenses
      .filter((row) => row.categoryId !== payrollCategory?.id)
      .map((row) => ({
        categoryId: row.categoryId,
        categoryName: categoryName.get(row.categoryId) ?? "Diğer",
        monthlyAmount: Math.round((Number(row._sum.amount ?? 0) / RECURRING_LOOKBACK_MONTHS) * 100) / 100,
      }))
      .filter((row) => row.monthlyAmount > 0);

    const monthlyPayroll = Math.round(payrollDrafts.reduce((sum, d) => sum + d.baseAmount, 0) * 100) / 100;
    if (monthlyPayroll > 0) {
      recurringByCategory.push({
        // Kategori henüz hiç oluşmadıysa (ilk bordro ödenmemiş) sentetik
        // bir anahtar kullanılır; girilmiş bir gider onunla eşleşmez, bu da
        // doğru davranıştır — eşleşecek bir kayıt zaten yok.
        categoryId: payrollCategory?.id ?? "__payroll__",
        categoryName: PAYROLL_CATEGORY,
        monthlyAmount: monthlyPayroll,
      });
    }

    const projection = projectCashflow({
      openingBalance,
      startMonth,
      monthCount,
      collectionRate,
      openInstallments,
      pendingExpenses: pendingExpenses.map((e) => ({
        dueDate: e.dueDate as Date,
        amount: Number(e.amount),
        categoryId: e.categoryId,
      })),
      recurringByCategory,
      alreadyPaidByCategory: paidThisMonth.map((r) => ({
        categoryId: r.categoryId,
        amount: Number(r._sum.amount ?? 0),
      })),
    });

    // Projeksiyona DAHİL EDİLMEYEN birikmiş alacak — müdür bunu "elde
    // edilebilecek ek nakit" olarak ayrıca görsün.
    const overdue = await prisma.installment.findMany({
      where: { institutionId: session.institutionId, status: { in: ["PENDING", "PARTIALLY_PAID"] }, dueDate: { lt: startMonth } },
      select: { amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    });
    const overdueBacklog =
      Math.round(overdue.reduce((sum, i) => sum + (Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)), 0) * 100) / 100;

    return NextResponse.json({
      ...projection,
      basis: {
        openingBalance: Math.round(openingBalance * 100) / 100,
        collectionRate: Math.round(collectionRate * 1000) / 1000,
        collectionRateWindowMonths: RATE_LOOKBACK_MONTHS,
        monthlyPayroll,
        recurringLookbackMonths: RECURRING_LOOKBACK_MONTHS,
        recurringByCategory: recurringByCategory.sort((a, b) => b.monthlyAmount - a.monthlyAmount),
        overdueBacklog,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("cashflow_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/cashflow", handleGet);
