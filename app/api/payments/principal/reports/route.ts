import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Alacak yaşlandırma kovaları — rakibin panelinde de öne çıkan "gecikme
// dağılımı" görünümü. Sınırlar gün cinsinden, üst sınır dahil DEĞİL.
const AGING_BUCKETS = [
  { key: "0-30", label: "0-30 gün", min: 0, max: 30 },
  { key: "31-60", label: "31-60 gün", min: 31, max: 60 },
  { key: "61-90", label: "61-90 gün", min: 61, max: 90 },
  { key: "90+", label: "90+ gün", min: 91, max: Number.POSITIVE_INFINITY },
] as const;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// GET /api/payments/principal/reports?months=12
// Tüm rapor blokları TEK istekte döner — rapor ekranı açılırken 5 ayrı
// istek atmak yerine (hepsi aynı veri kümesinden türüyor) tek turda
// hesaplanır.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const institutionId = session.institutionId;

    const monthsParam = Number(request.nextUrl.searchParams.get("months"));
    const months = Number.isInteger(monthsParam) && monthsParam >= 3 && monthsParam <= 24 ? monthsParam : 12;

    const now = new Date();
    const trendStart = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const [openInstallments, payments, expenses, categories, admins, voidedByAdmin] = await Promise.all([
      prisma.installment.findMany({
        where: { institutionId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } } },
          payments: { where: { status: "COMPLETED" }, select: { amount: true } },
        },
      }),
      prisma.payment.findMany({
        where: { institutionId, status: "COMPLETED", paidAt: { gte: trendStart } },
        select: { amount: true, method: true, paidAt: true, recordedByAdminId: true },
      }),
      prisma.expense.findMany({
        where: { institutionId, status: "PAID", paidAt: { gte: trendStart } },
        select: { amount: true, paidAt: true, categoryId: true },
      }),
      prisma.expenseCategory.findMany({ where: { institutionId }, select: { id: true, name: true } }),
      // Tahsilat performansı — recordedByAdminId her tahsilatta zaten
      // kaydediliyordu ama hiçbir ekranda görünmüyordu.
      prisma.admin.findMany({ where: { institutionId }, select: { id: true, firstName: true, lastName: true } }),
      // İptal edilen tahsilatlar kişi bazında: çok sayıda iptal, veri
      // girişinde sorun olduğunun sinyalidir.
      prisma.payment.groupBy({
        by: ["recordedByAdminId"],
        where: { institutionId, status: "VOIDED", paidAt: { gte: trendStart } },
        _count: { _all: true },
      }),
    ]);

    // --- 1) Alacak yaşlandırma + riskli öğrenciler ---
    const aging = AGING_BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: 0, count: 0 }));
    const riskByStudent = new Map<string, { studentId: string; studentName: string; branchName: string; overdueAmount: number; oldestDays: number; installmentCount: number }>();
    let totalOverdue = 0;
    let totalNotYetDue = 0;

    for (const inst of openInstallments) {
      const paid = inst.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const remaining = Number(inst.amount) - paid;
      if (remaining <= 0) continue;

      const daysOverdue = Math.floor((now.getTime() - inst.dueDate.getTime()) / 86_400_000);
      if (daysOverdue < 0) {
        totalNotYetDue += remaining;
        continue;
      }

      totalOverdue += remaining;
      const bucketIndex = AGING_BUCKETS.findIndex((b) => daysOverdue >= b.min && daysOverdue <= b.max);
      if (bucketIndex >= 0) {
        aging[bucketIndex].amount += remaining;
        aging[bucketIndex].count += 1;
      }

      const existing = riskByStudent.get(inst.studentId);
      if (existing) {
        existing.overdueAmount += remaining;
        existing.installmentCount += 1;
        existing.oldestDays = Math.max(existing.oldestDays, daysOverdue);
      } else {
        riskByStudent.set(inst.studentId, {
          studentId: inst.studentId,
          studentName: `${inst.student.firstName} ${inst.student.lastName}`,
          branchName: inst.student.branch.name,
          overdueAmount: remaining,
          oldestDays: daysOverdue,
          installmentCount: 1,
        });
      }
    }

    const riskyStudents = [...riskByStudent.values()].sort((a, b) => b.overdueAmount - a.overdueAmount).slice(0, 20);

    // --- 2) Aylık gelir/gider trendi ---
    const trendMap = new Map<string, { month: string; income: number; expense: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
      trendMap.set(monthKey(d), { month: monthKey(d), income: 0, expense: 0 });
    }
    for (const p of payments) {
      const row = trendMap.get(monthKey(p.paidAt));
      if (row) row.income += Number(p.amount);
    }
    for (const e of expenses) {
      if (!e.paidAt) continue;
      const row = trendMap.get(monthKey(e.paidAt));
      if (row) row.expense += Number(e.amount);
    }
    const monthlyTrend = [...trendMap.values()].map((r) => ({ ...r, net: r.income - r.expense }));

    // --- 3) Ödeme yöntemi dağılımı ---
    const methodMap = new Map<string, number>();
    for (const p of payments) methodMap.set(p.method, (methodMap.get(p.method) ?? 0) + Number(p.amount));
    const methodBreakdown = [...methodMap.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);

    // --- 4) Kategori bazlı gider ---
    const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
    const catMap = new Map<string, number>();
    for (const e of expenses) catMap.set(e.categoryId, (catMap.get(e.categoryId) ?? 0) + Number(e.amount));
    const expenseByCategory = [...catMap.entries()]
      .map(([id, amount]) => ({ name: categoryNameById.get(id) ?? "Diğer", amount }))
      .sort((a, b) => b.amount - a.amount);

    // --- 5) Tahsilat performansı (kişi bazında) ---
    const adminName = new Map(admins.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));
    const voidCountByAdmin = new Map(voidedByAdmin.map((v) => [v.recordedByAdminId, v._count._all]));
    const perfMap = new Map<string, { amount: number; count: number }>();
    for (const p of payments) {
      const cur = perfMap.get(p.recordedByAdminId) ?? { amount: 0, count: 0 };
      cur.amount += Number(p.amount);
      cur.count += 1;
      perfMap.set(p.recordedByAdminId, cur);
    }
    const collectorPerformance = [...perfMap.entries()]
      .map(([adminId, v]) => ({
        adminId,
        name: adminName.get(adminId) ?? "—",
        amount: v.amount,
        count: v.count,
        voidedCount: voidCountByAdmin.get(adminId) ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // --- 6) Günlük tahsilat (son 30 gün) — "bugün ne kadar topladık" ---
    const dayMs = 86_400_000;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dailyCollections = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(todayStart.getTime() - (29 - i) * dayMs);
      return { date: day.toISOString().slice(0, 10), amount: 0 };
    });
    const dailyIndex = new Map(dailyCollections.map((d, i) => [d.date, i]));
    for (const p of payments) {
      const key = p.paidAt.toISOString().slice(0, 10);
      const idx = dailyIndex.get(key);
      if (idx != null) dailyCollections[idx].amount += Number(p.amount);
    }
    const todayTotal = dailyCollections[dailyCollections.length - 1]?.amount ?? 0;

    const periodIncome = payments.reduce((s, p) => s + Number(p.amount), 0);
    const periodExpense = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return NextResponse.json({
      months,
      summary: {
        periodIncome,
        periodExpense,
        periodNet: periodIncome - periodExpense,
        totalOverdue,
        totalNotYetDue,
        totalReceivable: totalOverdue + totalNotYetDue,
        overdueStudentCount: riskByStudent.size,
      },
      aging,
      riskyStudents,
      monthlyTrend,
      methodBreakdown,
      expenseByCategory,
      collectorPerformance,
      dailyCollections,
      todayTotal,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_reports_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/reports", handleGet);
