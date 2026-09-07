"use client";

import { useEffect, useState } from "react";
import { Loader2, Target, Pencil, TrendingUp, TrendingDown } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type BudgetMonth = { month: number; plannedIncome: number; actualIncome: number; plannedExpense: number; actualExpense: number };
type BudgetCategory = { id: string; name: string; planned: number[]; actual: number[] };
type BudgetData = {
  year: number;
  months: BudgetMonth[];
  categories: BudgetCategory[];
  totals: { plannedIncome: number; actualIncome: number; plannedExpense: number; actualExpense: number };
};

const MONTH_SHORT = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Sapma rengi: GELİRDE hedefin altı kötü (kırmızı), GİDERDE hedefin üstü
// kötü — aynı sayı iki tabloda ZIT anlama gelir, renk bunu yansıtmalı.
function varianceTone(variance: number, kind: "INCOME" | "EXPENSE") {
  const good = kind === "INCOME" ? variance >= 0 : variance <= 0;
  if (variance === 0) return "text-espresso-muted dark:text-cream/40";
  return good ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300";
}

export function BudgetTab() {
  const { showError } = useToast();
  const [data, setData] = useState<BudgetData | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [editOpen, setEditOpen] = useState(false);

  function load() {
    setData(null);
    fetch(`/api/payments/principal/budget?year=${year}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setData(d))
      .catch(() => showError("Bütçe yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const plannedNet = data.totals.plannedIncome - data.totals.plannedExpense;
  const actualNet = data.totals.actualIncome - data.totals.actualExpense;
  const hasPlan = data.totals.plannedIncome > 0 || data.totals.plannedExpense > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {[year - 1, year, year + 1].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                y === year ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50"
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          <Pencil className="h-3.5 w-3.5" /> Bütçe Tanımla
        </button>
      </div>

      {!hasPlan && (
        <div className="rounded-2xl border border-dashed border-amber-400/40 bg-amber-500/5 p-4 text-center">
          <Target className="mx-auto mb-2 h-8 w-8 text-amber-500" />
          <p className="text-xs text-espresso dark:text-cream">
            {year} yılı için henüz bütçe tanımlanmamış. &quot;Bütçe Tanımla&quot; ile aylık gelir hedefini ve gider kalemlerini girin — gerçekleşen rakamlar buraya otomatik düşer.
          </p>
        </div>
      )}

      {/* Yıl özeti */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={TrendingUp} label="Gelir Hedefi" planned={data.totals.plannedIncome} actual={data.totals.actualIncome} kind="INCOME" />
        <SummaryCard icon={TrendingDown} label="Gider Bütçesi" planned={data.totals.plannedExpense} actual={data.totals.actualExpense} kind="EXPENSE" />
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Hedef Net</p>
          <p className="text-lg font-bold text-espresso dark:text-cream">{formatTRY(plannedNet)}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Gerçekleşen Net</p>
          <p className={cn("text-lg font-bold", actualNet >= plannedNet ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300")}>
            {formatTRY(actualNet)}
          </p>
        </div>
      </div>

      {/* Aylık plan / gerçekleşen */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <h3 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Aylık Plan / Gerçekleşen</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[11px]">
            <thead>
              <tr className="border-b border-hairline text-espresso-muted dark:border-white/5 dark:text-cream/40">
                <th className="py-1.5 text-left font-medium">Ay</th>
                <th className="py-1.5 text-right font-medium">Gelir Hedef</th>
                <th className="py-1.5 text-right font-medium">Gelir Gerçek</th>
                <th className="py-1.5 text-right font-medium">Sapma</th>
                <th className="py-1.5 text-right font-medium">Gider Bütçe</th>
                <th className="py-1.5 text-right font-medium">Gider Gerçek</th>
                <th className="py-1.5 text-right font-medium">Sapma</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => {
                const iv = m.actualIncome - m.plannedIncome;
                const ev = m.actualExpense - m.plannedExpense;
                const isEmpty = m.plannedIncome === 0 && m.actualIncome === 0 && m.plannedExpense === 0 && m.actualExpense === 0;
                return (
                  <tr key={m.month} className={cn("border-b border-hairline/60 dark:border-white/5", isEmpty && "opacity-40")}>
                    <td className="py-1.5 font-medium text-espresso dark:text-cream">{MONTH_SHORT[m.month - 1]}</td>
                    <td className="py-1.5 text-right text-espresso-muted dark:text-cream/50">{formatTRY(m.plannedIncome)}</td>
                    <td className="py-1.5 text-right font-semibold text-espresso dark:text-cream">{formatTRY(m.actualIncome)}</td>
                    <td className={cn("py-1.5 text-right font-semibold", varianceTone(iv, "INCOME"))}>
                      {iv > 0 ? "+" : ""}
                      {formatTRY(iv)}
                    </td>
                    <td className="py-1.5 text-right text-espresso-muted dark:text-cream/50">{formatTRY(m.plannedExpense)}</td>
                    <td className="py-1.5 text-right font-semibold text-espresso dark:text-cream">{formatTRY(m.actualExpense)}</td>
                    <td className={cn("py-1.5 text-right font-semibold", varianceTone(ev, "EXPENSE"))}>
                      {ev > 0 ? "+" : ""}
                      {formatTRY(ev)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kategori bazlı gider bütçesi */}
      <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <h3 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Gider Kalemleri (yıllık)</h3>
        <div className="space-y-2">
          {(() => {
            // Bütçesi OLMAYAN kalemlerin çubuğu, bütçelilerle aynı ölçekte
            // okunamaz — oran hesaplanamıyor. Bu yüzden onlar kendi
            // aralarındaki EN BÜYÜK harcamaya göre ve NÖTR renkte çizilir;
            // aksi halde (önceki hali) tam dolu yeşil çubuk çiziliyordu ve
            // "bütçesinin %100'ünü kullanmış" gibi YANLIŞ okunuyordu.
            const maxUnbudgeted = Math.max(
              1,
              ...data.categories.filter((c) => c.planned.reduce((s, v) => s + v, 0) === 0).map((c) => c.actual.reduce((s, v) => s + v, 0))
            );
            return data.categories.map((c) => {
              const planned = c.planned.reduce((s, v) => s + v, 0);
              const actual = c.actual.reduce((s, v) => s + v, 0);
              if (planned === 0 && actual === 0) return null;
              const hasBudget = planned > 0;
              const usage = hasBudget ? (actual / planned) * 100 : 0;
              const over = hasBudget && actual > planned;
              const width = hasBudget ? Math.min(100, usage) : (actual / maxUnbudgeted) * 100;
              return (
              <div key={c.id} className="flex items-center gap-2">
                <span className="w-36 shrink-0 truncate text-[11px] text-espresso dark:text-cream">{c.name}</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <span
                    className={cn("block h-full rounded-full", !hasBudget ? "bg-gray-300 dark:bg-white/25" : over ? "bg-rose-500" : "bg-emerald-500")}
                    style={{ width: `${width}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right text-[11px] font-semibold text-espresso dark:text-cream">{formatTRY(actual)}</span>
                <span className="w-24 shrink-0 text-right text-[10px] text-espresso-muted dark:text-cream/40">
                  {hasBudget ? `/ ${formatTRY(planned)}` : "bütçesiz"}
                </span>
                <span className={cn("w-12 shrink-0 text-right text-[10px] font-semibold", over ? "text-rose-700 dark:text-rose-300" : "text-espresso-muted dark:text-cream/40")}>
                  {hasBudget ? `%${Math.round(usage)}` : "—"}
                </span>
              </div>
              );
            });
          })()}
        </div>
      </div>

      <BudgetEditModal isOpen={editOpen} onClose={() => setEditOpen(false)} year={year} categories={data.categories} onSaved={load} />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  planned,
  actual,
  kind,
}: {
  icon: typeof TrendingUp;
  label: string;
  planned: number;
  actual: number;
  kind: "INCOME" | "EXPENSE";
}) {
  const variance = actual - planned;
  const rate = planned > 0 ? (actual / planned) * 100 : 0;
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", kind === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")} />
        <p className="text-[11px] text-espresso-muted dark:text-cream/40">{label}</p>
      </div>
      <p className="text-lg font-bold text-espresso dark:text-cream">{formatTRY(actual)}</p>
      <p className="text-[10px] text-espresso-muted dark:text-cream/40">
        hedef {formatTRY(planned)}
        {planned > 0 ? ` · %${Math.round(rate)}` : ""}
      </p>
      {planned > 0 && (
        <p className={cn("mt-0.5 text-[10px] font-semibold", varianceTone(variance, kind))}>
          {variance > 0 ? "+" : ""}
          {formatTRY(variance)}
        </p>
      )}
    </div>
  );
}

function BudgetEditModal({
  isOpen,
  onClose,
  year,
  categories,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  categories: BudgetCategory[];
  onSaved: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [kind, setKind] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [applyAll, setApplyAll] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setKind("INCOME");
    setCategoryId(categories[0]?.id ?? "");
    setAmount("");
    setApplyAll(true);
  }, [isOpen, categories]);

  async function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) return showError("Geçerli bir tutar girin.");
    if (kind === "EXPENSE" && !categoryId) return showError("Kategori seçin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          kind,
          categoryId: kind === "EXPENSE" ? categoryId : undefined,
          plannedAmount: value,
          applyAllMonths: applyAll,
          month: applyAll ? undefined : month,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess(`${d.updatedMonths} ay güncellendi.`);
      onSaved();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${year} Bütçe Tanımı`} variant="center" widthClassName="max-w-sm">
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setKind("INCOME")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
              kind === "INCOME" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
            )}
          >
            Gelir Hedefi
          </button>
          <button
            onClick={() => setKind("EXPENSE")}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
              kind === "EXPENSE" ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
            )}
          >
            Gider Bütçesi
          </button>
        </div>

        {kind === "EXPENSE" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Kategori</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Aylık Tutar (₺)</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-espresso dark:text-cream">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
          12 ayın tamamına uygula
        </label>

        {!applyAll && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Ay</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass}>
              {MONTH_SHORT.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} Kaydet
        </button>
      </div>
    </Modal>
  );
}
