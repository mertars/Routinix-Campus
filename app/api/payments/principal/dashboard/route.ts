import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/dashboard — Kontrol Paneli özeti: kasa/banka
// bakiyeleri, bu ay tahsilat, bekleyen/gecikmiş toplamlar, son işlemler,
// gecikmiş taksitler listesi. Tümü Payment/Installment üzerinden CANLI
// hesaplanır (bkz. accounts/route.ts'teki AYNI "cache yok" gerekçesi).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");
    const institutionId = session.institutionId;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // ⚠️ ÜST SINIR ŞART: yalnızca `gte: monthStart` yazıldığında İLERİ
    // tarihli kayıtlar da "bu ay"a giriyordu — ileri tarihli bir tahsilat
    // (ya da yıl yanlış yazılmış bir kayıt) bu ayın rakamını kalıcı
    // olarak şişiriyordu.
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const thisMonth = { gte: monthStart, lt: monthEnd };

    const [accountRows, monthPayments, openInstallments, recentPayments, plannedTotal, collectedTotal, monthExpense, expenseByCategory, pendingExpenses] = await Promise.all([
      computeAccountBalances(institutionId),
      prisma.payment.aggregate({ where: { institutionId, status: "COMPLETED", paidAt: thisMonth }, _sum: { amount: true } }),
      prisma.installment.findMany({
        where: { institutionId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
        include: { student: { select: { firstName: true, lastName: true } }, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
      }),
      prisma.payment.findMany({
        where: { institutionId, status: "COMPLETED" },
        orderBy: { paidAt: "desc" },
        take: 10,
        include: { student: { select: { firstName: true, lastName: true } }, account: { select: { name: true } } },
      }),
      // Tahsilat oranı — planlanan TÜM taksitlerin toplamı vs bugüne kadar
      // tahsil edilen toplam (iptal edilen taksitler plana dahil DEĞİL).
      prisma.installment.aggregate({ where: { institutionId, status: { not: "CANCELLED" } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { institutionId, status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.expense.aggregate({ where: { institutionId, status: "PAID", paidAt: thisMonth }, _sum: { amount: true } }),
      prisma.expense.groupBy({ by: ["categoryId"], where: { institutionId, status: "PAID", paidAt: thisMonth }, _sum: { amount: true } }),
      prisma.expense.findMany({
        where: { institutionId, status: "PENDING" },
        include: { category: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }],
        take: 20,
      }),
    ]);

    const totalBalance = accountRows.reduce((sum, a) => sum + a.balance, 0);

    const categoryNameById = new Map((await prisma.expenseCategory.findMany({ where: { institutionId }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
    const monthlyExpense = Number(monthExpense._sum.amount ?? 0);
    const expenseBreakdown = expenseByCategory
      .map((row) => ({ name: categoryNameById.get(row.categoryId) ?? "Diğer", amount: Number(row._sum.amount ?? 0) }))
      .sort((a, b) => b.amount - a.amount);

    let pendingTotal = 0;
    let overdueTotal = 0;
    const overdueList: { id: string; studentId: string; studentName: string; title: string; remainingAmount: number; dueDate: string }[] = [];
    for (const inst of openInstallments) {
      const paid = inst.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(inst.amount) - paid;
      pendingTotal += remaining;
      if (inst.dueDate < now) {
        overdueTotal += remaining;
        overdueList.push({
          id: inst.id,
          studentId: inst.studentId,
          studentName: `${inst.student.firstName} ${inst.student.lastName}`,
          title: inst.title,
          remainingAmount: remaining,
          dueDate: inst.dueDate.toISOString(),
        });
      }
    }
    overdueList.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return NextResponse.json({
      accounts: accountRows,
      totalBalance,
      monthlyCollected: Number(monthPayments._sum.amount ?? 0),
      monthlyExpense,
      monthlyNet: Number(monthPayments._sum.amount ?? 0) - monthlyExpense,
      expenseBreakdown,
      pendingExpenses: pendingExpenses.map((e) => ({
        id: e.id,
        title: e.title,
        categoryName: e.category.name,
        vendorName: e.vendorName,
        amount: Number(e.amount),
        dueDate: e.dueDate?.toISOString() ?? null,
        isOverdue: e.dueDate != null && e.dueDate < now,
      })),
      pendingExpenseTotal: pendingExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      plannedTotal: Number(plannedTotal._sum.amount ?? 0),
      collectedTotal: Number(collectedTotal._sum.amount ?? 0),
      pendingTotal,
      overdueTotal,
      overdueInstallments: overdueList.slice(0, 20),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        studentName: `${p.student.firstName} ${p.student.lastName}`,
        accountName: p.account.name,
        amount: Number(p.amount),
        method: p.method,
        paidAt: p.paidAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payments_dashboard_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/dashboard", handleGet);
