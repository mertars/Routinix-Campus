import { prisma } from "@/lib/server/prisma";

export type AccountBalanceRow = { id: string; name: string; type: "CASH" | "BANK"; balance: number };

// Kasa/banka bakiyesi ÜÇ kaynaktan beslenir:
//   + tahsil edilen gelir (Payment, COMPLETED)
//   − ödenmiş gider (Expense, PAID)
//   ± hesaplar arası virman (AccountTransfer)
// Bu formül accounts ve dashboard route'larında AYRI AYRI yazılıydı; virman
// eklenince ikisinden birinde unutulma riski doğduğu için TEK yere alındı.
// Bakiye hiçbir yerde cache'lenmez, her istekte toplanır (bkz. accounts
// route'undaki gerekçe).
export async function computeAccountBalances(institutionId: string): Promise<AccountBalanceRow[]> {
  const [accounts, incomes, paidExpenses, transfersOut, transfersIn] = await Promise.all([
    prisma.paymentAccount.findMany({
      where: { institutionId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.groupBy({
      by: ["accountId"],
      where: { institutionId, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.expense.groupBy({
      by: ["accountId"],
      where: { institutionId, status: "PAID", accountId: { not: null } },
      _sum: { amount: true },
    }),
    prisma.accountTransfer.groupBy({ by: ["fromAccountId"], where: { institutionId }, _sum: { amount: true } }),
    prisma.accountTransfer.groupBy({ by: ["toAccountId"], where: { institutionId }, _sum: { amount: true } }),
  ]);

  const incomeBy = new Map(incomes.map((r) => [r.accountId, Number(r._sum.amount ?? 0)]));
  const expenseBy = new Map(paidExpenses.map((r) => [r.accountId as string, Number(r._sum.amount ?? 0)]));
  const outBy = new Map(transfersOut.map((r) => [r.fromAccountId, Number(r._sum.amount ?? 0)]));
  const inBy = new Map(transfersIn.map((r) => [r.toAccountId, Number(r._sum.amount ?? 0)]));

  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: (incomeBy.get(a.id) ?? 0) - (expenseBy.get(a.id) ?? 0) - (outBy.get(a.id) ?? 0) + (inBy.get(a.id) ?? 0),
  }));
}
