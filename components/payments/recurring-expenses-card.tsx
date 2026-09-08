"use client";

import { useEffect, useState } from "react";
import { Loader2, Repeat, Plus, Wand2, Power } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  vendorName: string | null;
  amount: number;
  dayOfMonth: number;
  isActive: boolean;
  generatedThisMonth: boolean;
};

type Payload = { currentMonth: string; templates: Template[]; pendingCount: number; monthlyTotal: number };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Tekrar eden gider şablonları.
//
// Bunlar olmadan müdür kirayı/faturayı HER AY sıfırdan yazıyordu. Şablon
// gideri otomatik ÖDEMEZ; ayın taslağını hazırlar, tutarı müdür
// düzeltip onaylar — fatura tutarı her ay değişir.
export function RecurringExpensesCard({
  categories,
  onGenerated,
}: {
  categories: { id: string; name: string }[];
  onGenerated: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ categoryId: "", title: "", amount: "", dayOfMonth: "5", vendorName: "" });

  function load() {
    fetch("/api/payments/principal/recurring-expenses")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d: Payload) => setData(d))
      .catch(() => showError("Tekrar eden giderler yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    if (!form.categoryId || !form.title.trim() || !Number(form.amount)) {
      return showError("Kategori, başlık ve tutar zorunludur.");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/payments/principal/recurring-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: form.categoryId,
          title: form.title.trim(),
          amount: Number(form.amount),
          dayOfMonth: Number(form.dayOfMonth),
          vendorName: form.vendorName.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess("Şablon eklendi. Artık her ay tek tıkla hazırlanacak.");
      setForm({ categoryId: "", title: "", amount: "", dayOfMonth: "5", vendorName: "" });
      setAdding(false);
      load();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Şablon eklenemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/payments/principal/recurring-expenses/generate", { method: "POST" });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess(d.created > 0 ? `${d.created} gider taslağı hazırlandı. Giderler sekmesinden onaylayın.` : d.message);
      load();
      onGenerated();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Hazırlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(t: Template) {
    try {
      const res = await fetch("/api/payments/principal/recurring-expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, isActive: !t.isActive }),
      });
      if (!res.ok) throw new Error();
      load();
    } catch {
      showError("Güncellenemedi.");
    }
  }

  const inputClass =
    "rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Repeat className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Tekrar Eden Giderler
          </h3>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Kira, fatura, temizlik… Bir kez tanımlayın, her ay tek tıkla hazırlansın.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          <Plus className="h-3.5 w-3.5" /> Şablon Ekle
        </button>
      </div>

      {adding && (
        <div className="mb-3 grid gap-2 rounded-xl border border-hairline bg-cream-card/50 p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-white/[0.03]">
          <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={inputClass}>
            <option value="">Kategori seçin…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Başlık (Kira)" className={inputClass} />
          <input
            type="number"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Aylık tutar (₺)"
            className={inputClass}
          />
          <input
            type="number"
            min={1}
            max={28}
            value={form.dayOfMonth}
            onChange={(e) => setForm({ ...form, dayOfMonth: e.target.value })}
            placeholder="Ayın kaçında"
            className={inputClass}
          />
          <input
            value={form.vendorName}
            onChange={(e) => setForm({ ...form, vendorName: e.target.value })}
            placeholder="Tedarikçi (isteğe bağlı)"
            className={cn(inputClass, "sm:col-span-2")}
          />
          <button
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50 sm:col-span-2"
          >
            Kaydet
          </button>
        </div>
      )}

      {!data ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : data.templates.length === 0 ? (
        <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
          Henüz şablon yok. Kirayı bir kez tanımlayın, bir daha yazmayın.
        </p>
      ) : (
        <>
          {data.pendingCount > 0 && (
            <button
              onClick={generate}
              disabled={busy}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Bu ayın {data.pendingCount} giderini hazırla
            </button>
          )}
          <div className="space-y-1.5">
            {data.templates.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                  t.isActive ? "border-hairline dark:border-white/5" : "border-hairline opacity-50 dark:border-white/5"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-espresso dark:text-cream">
                    {t.title}
                    <span className="font-normal text-espresso-muted dark:text-cream/50"> · {t.categoryName}</span>
                  </p>
                  <p className="text-[10px] text-espresso-muted dark:text-cream/40">
                    Her ayın {t.dayOfMonth}&apos;i · {t.vendorName ?? "tedarikçi yok"}
                    {t.generatedThisMonth && " · bu ay hazırlandı"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-semibold text-espresso dark:text-cream">{formatTRY(t.amount)}</span>
                  <button
                    onClick={() => toggle(t)}
                    title={t.isActive ? "Pasifleştir" : "Aktifleştir"}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg border transition",
                      t.isActive
                        ? "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                        : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/40"
                    )}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-espresso-muted dark:text-cream/40">
            Aylık sabit gider toplamı: <strong>{formatTRY(data.monthlyTotal)}</strong>. Hazırlanan giderler taslak olarak
            Giderler sekmesine düşer; ödemeyi siz onaylarsınız.
          </p>
        </>
      )}
    </div>
  );
}
