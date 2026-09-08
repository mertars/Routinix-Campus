import { prisma } from "@/lib/server/prisma";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";

// tab: uyarının çözüleceği sekme. Uyarı ne olduğunu söyleyip nereye
// gidileceğini söylemezse müdür yine sekme sekme aramak zorunda kalır.
export type DigestAlert = { key: string; severity: "warning" | "critical"; text: string; tab: string };

export type Digest = {
  institutionId: string;
  institutionName: string;
  collectedYesterday: number;
  totalBalance: number;
  overdueTotal: number;
  overdueCount: number;
  dueTodayTotal: number;
  dueTodayCount: number;
  pendingExpenseTotal: number;
  alerts: DigestAlert[];
};

function tl(n: number): string {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Günlük özet.
//
// Müdür kötü haberi öğrenmek için paneli AÇMAK zorundaydı: banka eksiye
// düştü, gecikme büyüdü, bugün ödenmesi gereken bir fatura var — hiçbiri
// kendini duyurmuyordu.
//
// Özet YALNIZCA kayda değer bir şey varsa gönderilir (bkz. isWorthSending):
// her sabah "her şey normal" mesajı atmak, bir süre sonra okunmayan bir
// bildirime dönüşür ve gerçekten önemli olan gün de gözden kaçar.
export async function buildDigest(institutionId: string, institutionName: string): Promise<Digest> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);

  const [balances, yesterdayPayments, overdue, dueToday, pendingExpenses] = await Promise.all([
    computeAccountBalances(institutionId),
    prisma.payment.aggregate({
      where: { institutionId, status: "COMPLETED", paidAt: { gte: yesterdayStart, lt: todayStart } },
      _sum: { amount: true },
    }),
    prisma.installment.findMany({
      where: { institutionId, status: { in: ["PENDING", "PARTIALLY_PAID"] }, dueDate: { lt: todayStart } },
      select: { amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    }),
    prisma.installment.findMany({
      where: { institutionId, status: { in: ["PENDING", "PARTIALLY_PAID"] }, dueDate: { gte: todayStart, lt: tomorrowStart } },
      select: { amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    }),
    prisma.expense.aggregate({
      where: { institutionId, status: "PENDING", dueDate: { lt: tomorrowStart } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const remaining = (rows: { amount: unknown; payments: { amount: unknown }[] }[]) =>
    Math.round(
      rows.reduce((sum, i) => sum + (Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)), 0) * 100
    ) / 100;

  const totalBalance = Math.round(balances.reduce((sum, b) => sum + b.balance, 0) * 100) / 100;
  const overdueTotal = remaining(overdue);
  const dueTodayTotal = remaining(dueToday);
  const pendingExpenseTotal = Number(pendingExpenses._sum.amount ?? 0);

  const alerts: DigestAlert[] = [];
  // Eksi bakiye en kritik uyarı: para çıkışları durdurulmalı.
  const negative = balances.filter((b) => b.balance < 0);
  for (const account of negative) {
    alerts.push({
      key: `negative:${account.id}`,
      severity: "critical",
      text: `${account.name} eksi bakiyede: ${tl(account.balance)}`,
      tab: "accounts",
    });
  }
  // Bugün ödenmesi gereken gider, kasada karşılığı yoksa kritiktir.
  if (pendingExpenseTotal > 0 && totalBalance < pendingExpenseTotal) {
    alerts.push({
      key: "expense-shortfall",
      severity: "critical",
      text: `Vadesi bugün/geçmiş ${pendingExpenses._count} gider (${tl(pendingExpenseTotal)}) için kasada yeterli para yok.`,
      tab: "expenses",
    });
  }
  if (overdueTotal > 0) {
    alerts.push({ key: "overdue", severity: "warning", text: `${overdue.length} gecikmiş taksit · ${tl(overdueTotal)}`, tab: "dashboard" });
  }

  return {
    institutionId,
    institutionName,
    collectedYesterday: Number(yesterdayPayments._sum.amount ?? 0),
    totalBalance,
    overdueTotal,
    overdueCount: overdue.length,
    dueTodayTotal,
    dueTodayCount: dueToday.length,
    pendingExpenseTotal,
    alerts,
  };
}

// Gönderilmeye değer mi? Kritik bir uyarı, gecikme ya da bugün vadesi
// dolan bir tahsilat varsa evet. Sakin bir günde susmak, bildirimi
// okunur tutmanın tek yolu.
export function isWorthSending(digest: Digest): boolean {
  return digest.alerts.length > 0 || digest.dueTodayCount > 0;
}

export function renderDigestText(digest: Digest): string {
  const lines = [`${digest.institutionName} — günlük özet`];
  if (digest.collectedYesterday > 0) lines.push(`Dün tahsil edilen: ${tl(digest.collectedYesterday)}`);
  lines.push(`Kasa+banka: ${tl(digest.totalBalance)}`);
  if (digest.dueTodayCount > 0) lines.push(`Bugün vadesi dolan: ${digest.dueTodayCount} taksit · ${tl(digest.dueTodayTotal)}`);
  for (const alert of digest.alerts) lines.push(`${alert.severity === "critical" ? "!!" : "!"} ${alert.text}`);
  return lines.join("\n");
}
