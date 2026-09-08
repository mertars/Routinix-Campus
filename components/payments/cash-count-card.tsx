"use client";

import { useEffect, useState } from "react";
import { Loader2, Calculator, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type CashAccount = { id: string; name: string; systemBalance: number; lastCountedAt: string | null };
type CountRow = {
  id: string;
  accountName: string;
  countedAt: string;
  systemBalance: number;
  countedAmount: number;
  difference: number;
  note: string | null;
  countedBy: string;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Gün sonu kasa sayımı.
//
// Sayım bakiyeyi DÜZELTMEZ — fark bir olgu olarak kaydedilir. Bu, ekranda
// da açıkça yazar; aksi halde müdür "sayımı girdim, düzeldi" sanırdı.
export function CashCountCard() {
  const { showError, showSuccess } = useToast();
  const [accounts, setAccounts] = useState<CashAccount[] | null>(null);
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [active, setActive] = useState<CashAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/payments/principal/cash-counts")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => {
        setAccounts(d.accounts ?? []);
        setCounts(d.counts ?? []);
      })
      .catch(() => showError("Kasa sayımları yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counted = Number(amount);
  const preview = active && Number.isFinite(counted) ? Math.round((counted - active.systemBalance) * 100) / 100 : null;

  async function submit() {
    if (!active) return;
    if (!Number.isFinite(counted) || counted < 0) return showError("Geçerli bir sayım tutarı girin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/cash-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: active.id, countedAmount: counted, note: note.trim() || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess(
        d.difference === 0
          ? "Sayım tuttu, kayıt alındı."
          : `Sayım kaydedildi. ${d.difference > 0 ? "Fazla" : "Eksik"}: ${formatTRY(Math.abs(d.difference))}`
      );
      setActive(null);
      setAmount("");
      setNote("");
      load();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Sayım kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Calculator className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Gün Sonu Kasa Sayımı
      </h3>
      <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
        Kasadaki fiziksel parayı sayıp girin. Fark <strong>kayıt altına alınır</strong>, bakiye otomatik düzeltilmez.
      </p>

      {!accounts ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : accounts.length === 0 ? (
        <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
          Sayım yalnızca nakit kasalar için yapılır; tanımlı bir nakit kasanız yok.
        </p>
      ) : (
        <div className="mb-4 space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline p-3 dark:border-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">{a.name}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                  Sistem: {formatTRY(a.systemBalance)}
                  {a.lastCountedAt
                    ? ` · son sayım ${new Date(a.lastCountedAt).toLocaleDateString("tr-TR")}`
                    : " · henüz sayılmadı"}
                </p>
              </div>
              <button
                onClick={() => {
                  setActive(a);
                  setAmount("");
                  setNote("");
                }}
                className="shrink-0 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                Sayım Yap
              </button>
            </div>
          ))}
        </div>
      )}

      {counts.length > 0 && (
        <>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Son sayımlar
          </p>
          <div className="space-y-1.5">
            {counts.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-espresso dark:text-cream">
                    {c.accountName}
                    {c.note && <span className="font-normal text-espresso-muted dark:text-cream/50"> · {c.note}</span>}
                  </p>
                  <p className="text-[10px] text-espresso-muted dark:text-cream/40">
                    {new Date(c.countedAt).toLocaleDateString("tr-TR")} · {c.countedBy} · sistem {formatTRY(c.systemBalance)}, sayım{" "}
                    {formatTRY(c.countedAmount)}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                    c.difference === 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                  )}
                >
                  {c.difference === 0 ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Tuttu
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-3 w-3" /> {c.difference > 0 ? "+" : "−"}
                      {formatTRY(Math.abs(c.difference))}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal
        isOpen={active !== null}
        onClose={() => setActive(null)}
        title={active ? `Gün Sonu Sayımı — ${active.name}` : "Gün Sonu Sayımı"}
        variant="center"
        widthClassName="max-w-sm"
      >
        {active && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-hairline bg-cream-card/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-[11px] text-espresso-muted dark:text-cream/50">Sistemdeki bakiye</p>
              <p className="text-xl font-bold text-espresso dark:text-cream">{formatTRY(active.systemBalance)}</p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Sayılan Tutar (₺)</label>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
                className={inputClass}
              />
            </div>

            {preview !== null && amount !== "" && (
              <div
                className={cn(
                  "rounded-xl border p-3 text-[11px]",
                  preview === 0
                    ? "border-emerald-400/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
                    : "border-rose-400/30 bg-rose-500/5 text-rose-800 dark:text-rose-300"
                )}
              >
                {preview === 0 ? (
                  "Sayım sistemle birebir tutuyor."
                ) : (
                  <>
                    Kasada <strong>{formatTRY(Math.abs(preview))}</strong> {preview > 0 ? "fazla" : "eksik"} var. Bu fark
                    kayda geçer; bakiye otomatik düzeltilmez.
                  </>
                )}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Not (isteğe bağlı)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Akşam vardiyası"
                className={inputClass}
              />
            </div>

            <button
              onClick={submit}
              disabled={saving || amount === ""}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} Sayımı Kaydet
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
