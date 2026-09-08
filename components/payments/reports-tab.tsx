"use client";

import { useEffect, useState } from "react";
import { Loader2, Download, AlertTriangle, TrendingUp, TrendingDown, PieChart, Users, BadgePercent, UserCheck, CalendarDays } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type ReportData = {
  months: number;
  summary: {
    periodIncome: number;
    periodExpense: number;
    periodNet: number;
    totalOverdue: number;
    totalNotYetDue: number;
    totalReceivable: number;
    overdueStudentCount: number;
  };
  aging: { key: string; label: string; amount: number; count: number }[];
  riskyStudents: { studentId: string; studentName: string; branchName: string; overdueAmount: number; oldestDays: number; installmentCount: number }[];
  monthlyTrend: { month: string; income: number; expense: number; net: number }[];
  methodBreakdown: { method: string; amount: number }[];
  expenseByCategory: { name: string; amount: number }[];
  collectorPerformance: { adminId: string; name: string; amount: number; count: number; voidedCount: number }[];
  dailyCollections: { date: string; amount: number }[];
  todayTotal: number;
};

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][Number(m) - 1]} ${y.slice(2)}`;
}

// Yaşlandırma kovası ne kadar eskiyse o kadar koyu kırmızı — "90+ gün"
// listede kaybolmasın, bakışta ilk o yakalansın.
const AGING_TONE: Record<string, string> = {
  "0-30": "bg-amber-400",
  "31-60": "bg-orange-400",
  "61-90": "bg-rose-400",
  "90+": "bg-rose-600",
};

type DiscountSummary = {
  grantedTotal: number;
  listTotal: number;
  discountRate: number;
  studentCount: number;
  byType: { type: string; label: string; count: number; amount: number }[];
};

export function ReportsTab() {
  const { showError } = useToast();
  const [data, setData] = useState<ReportData | null>(null);
  const [discounts, setDiscounts] = useState<DiscountSummary | null>(null);
  const [months, setMonths] = useState(12);

  useEffect(() => {
    fetch("/api/payments/principal/discounts")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setDiscounts(d.summary ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    fetch(`/api/payments/principal/reports?months=${months}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => setData(d))
      .catch(() => showError("Raporlar yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  // Excel'in Türkçe yerelde doğru açması için BOM + noktalı virgül —
  // projedeki mevcut CSV dışa aktarım deseniyle aynı (bkz. olcme/results-table).
  function exportAgingCsv() {
    if (!data) return;
    const header = ["Öğrenci", "Şube", "Gecikmiş Tutar", "Taksit Sayısı", "En Eski Gecikme (gün)"];
    const lines = data.riskyStudents.map((s) => [s.studentName, s.branchName, s.overdueAmount, s.installmentCount, s.oldestDays]);
    const csv = [header, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alacak-raporu-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const agingMax = Math.max(1, ...data.aging.map((a) => a.amount));
  const trendMax = Math.max(1, ...data.monthlyTrend.map((m) => Math.max(m.income, m.expense)));
  const methodTotal = Math.max(1, data.methodBreakdown.reduce((s, m) => s + m.amount, 0));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              onClick={() => setMonths(m)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                months === m
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50"
              )}
            >
              Son {m} ay
            </button>
          ))}
        </div>
        <button
          onClick={exportAgingCsv}
          className="flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          <Download className="h-3.5 w-3.5" /> Alacak Raporu (CSV)
        </button>
      </div>

      {/* Dönem özeti */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard icon={TrendingUp} label={`${data.months} Ay Gelir`} value={formatTRY(data.summary.periodIncome)} tone="emerald" />
        <SummaryCard icon={TrendingDown} label={`${data.months} Ay Gider`} value={formatTRY(data.summary.periodExpense)} tone="rose" />
        <SummaryCard icon={PieChart} label="Dönem Net" value={formatTRY(data.summary.periodNet)} tone="sky" />
        <SummaryCard icon={AlertTriangle} label="Toplam Alacak" value={formatTRY(data.summary.totalReceivable)} tone="amber" />
      </div>

      {/* Aylık gelir/gider trendi */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <h3 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Aylık Gelir / Gider Trendi</h3>
        <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ minHeight: 140 }}>
          {data.monthlyTrend.map((m) => (
            <div key={m.month} className="flex min-w-[42px] flex-1 flex-col items-center gap-1">
              <div className="flex h-[104px] w-full items-end justify-center gap-0.5">
                <div
                  className="w-1/2 rounded-t bg-emerald-500 transition-[height] duration-500"
                  style={{ height: `${(m.income / trendMax) * 100}%` }}
                  title={`Gelir: ${formatTRY(m.income)}`}
                />
                <div
                  className="w-1/2 rounded-t bg-rose-400 transition-[height] duration-500"
                  style={{ height: `${(m.expense / trendMax) * 100}%` }}
                  title={`Gider: ${formatTRY(m.expense)}`}
                />
              </div>
              <span className="whitespace-nowrap text-[9px] text-espresso-muted dark:text-cream/40">{monthLabel(m.month)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 border-t border-hairline pt-2 text-[11px] dark:border-white/5">
          <span className="flex items-center gap-1.5 text-espresso-muted dark:text-cream/40">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Gelir
          </span>
          <span className="flex items-center gap-1.5 text-espresso-muted dark:text-cream/40">
            <span className="h-2 w-2 rounded-full bg-rose-400" /> Gider
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Alacak yaşlandırma */}
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Alacak Yaşlandırma</h3>
          <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
            Gecikmiş {formatTRY(data.summary.totalOverdue)} · vadesi gelmemiş {formatTRY(data.summary.totalNotYetDue)}
          </p>
          {data.aging.every((a) => a.amount === 0) ? (
            <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Gecikmiş alacak yok 🎉</p>
          ) : (
            <div className="space-y-2">
              {data.aging.map((a) => (
                <div key={a.key} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[11px] text-espresso dark:text-cream">{a.label}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                    <span className={cn("block h-full rounded-full", AGING_TONE[a.key])} style={{ width: `${(a.amount / agingMax) * 100}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(a.amount)}</span>
                  <span className="w-8 shrink-0 text-right text-[10px] text-espresso-muted dark:text-cream/40">{a.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tahsilat yöntemi + gider kategorisi */}
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Tahsilat Yöntemi Dağılımı</h3>
          {data.methodBreakdown.length === 0 ? (
            <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Bu dönemde tahsilat yok.</p>
          ) : (
            <div className="space-y-2">
              {data.methodBreakdown.map((m) => (
                <div key={m.method} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[11px] text-espresso dark:text-cream">{METHOD_LABEL[m.method] ?? m.method}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${(m.amount / methodTotal) * 100}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(m.amount)}</span>
                  <span className="w-9 shrink-0 text-right text-[10px] text-espresso-muted dark:text-cream/40">%{Math.round((m.amount / methodTotal) * 100)}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="mb-3 mt-5 border-t border-hairline pt-4 text-sm font-semibold text-espresso dark:text-cream dark:border-white/5">Gider Kategorileri</h3>
          {data.expenseByCategory.length === 0 ? (
            <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Bu dönemde gider yok.</p>
          ) : (
            <div className="space-y-2">
              {data.expenseByCategory.slice(0, 6).map((c) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[11px] text-espresso dark:text-cream">{c.name}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                    <span
                      className="block h-full rounded-full bg-rose-400"
                      style={{ width: `${(c.amount / Math.max(1, data.expenseByCategory[0].amount)) * 100}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Günlük tahsilat — müdürün her gün sorduğu "bugün ne topladık" */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <CalendarDays className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Günlük Tahsilat (son 30 gün)
          </h3>
          <p className="text-xs text-espresso-muted dark:text-cream/40">
            Bugün: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatTRY(data.todayTotal)}</span>
          </p>
        </div>
        <div className="flex h-20 items-end gap-[3px]">
          {data.dailyCollections.map((d, i) => {
            const max = Math.max(1, ...data.dailyCollections.map((x) => x.amount));
            const isToday = i === data.dailyCollections.length - 1;
            return (
              <div
                key={d.date}
                title={`${new Date(d.date).toLocaleDateString("tr-TR")}: ${formatTRY(d.amount)}`}
                className={cn("flex-1 rounded-t transition-[height] duration-500", isToday ? "bg-emerald-600" : "bg-emerald-400/60")}
                style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }}
              />
            );
          })}
        </div>
      </div>

      {/* Tahsilat performansı — veri zaten kayıtlıydı, ilk kez görünüyor */}
      {data.collectorPerformance.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Tahsilat Performansı
          </h3>
          <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">Son {data.months} ayda kim ne kadar tahsilat kaydetti.</p>
          <div className="space-y-2">
            {data.collectorPerformance.map((c) => (
              <div key={c.adminId} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-[11px] text-espresso dark:text-cream">{c.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${(c.amount / Math.max(1, data.collectorPerformance[0].amount)) * 100}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(c.amount)}</span>
                <span className="w-20 shrink-0 text-right text-[10px] text-espresso-muted dark:text-cream/40">{c.count} işlem</span>
                <span
                  className={cn(
                    "w-16 shrink-0 text-right text-[10px]",
                    c.voidedCount > 0 ? "font-semibold text-rose-700 dark:text-rose-300" : "text-espresso-muted/50 dark:text-cream/25"
                  )}
                  title="İptal edilen tahsilat sayısı — yüksekse veri girişinde sorun olabilir"
                >
                  {c.voidedCount > 0 ? `${c.voidedCount} iptal` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Burs & indirim — "ne kadar burs dağıttık" */}
      {discounts && discounts.grantedTotal > 0 && (
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <BadgePercent className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Burs & İndirim
          </h3>
          <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
            {discounts.studentCount} öğrenciye toplam {formatTRY(discounts.grantedTotal)} indirim uygulandı · liste fiyatının %{Math.round(discounts.discountRate)}&apos;i
          </p>
          <div className="space-y-2">
            {discounts.byType.filter((t) => t.amount > 0).map((t) => (
              <div key={t.type} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-[11px] text-espresso dark:text-cream">{t.label}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${(t.amount / Math.max(1, discounts.byType[0].amount)) * 100}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(t.amount)}</span>
                <span className="w-16 shrink-0 text-right text-[10px] text-espresso-muted dark:text-cream/40">{t.count} öğrenci</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Riskli öğrenci listesi */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Users className="h-4 w-4 text-rose-600 dark:text-rose-400" /> Riskli Öğrenci Listesi
          <span className="font-normal text-espresso-muted dark:text-cream/40">({data.summary.overdueStudentCount} öğrenci)</span>
        </h3>
        {data.riskyStudents.length === 0 ? (
          <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Gecikmiş ödemesi olan öğrenci yok 🎉</p>
        ) : (
          <div className="space-y-1.5">
            {data.riskyStudents.map((s, i) => (
              <div key={s.studentId} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="w-5 shrink-0 text-center text-[11px] font-semibold text-espresso-muted dark:text-cream/40">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">{s.studentName}</p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {s.branchName} · {s.installmentCount} taksit · en eski {s.oldestDays} gün
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    s.oldestDays > 90 ? "bg-rose-500/15 text-rose-700 dark:text-rose-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  )}
                >
                  {formatTRY(s.overdueAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof TrendingUp; label: string; value: string; tone: "emerald" | "rose" | "sky" | "amber" }) {
  const toneClass = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  }[tone];
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", toneClass)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xl font-bold text-espresso dark:text-cream">{value}</p>
      <p className="text-xs text-espresso-muted dark:text-cream/40">{label}</p>
    </div>
  );
}
