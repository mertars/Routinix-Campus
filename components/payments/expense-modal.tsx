"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { AccountRow } from "@/components/payments/payments-principal-panel";
import { TemplateBar } from "@/components/ui/template-bar";

export type ExpenseCategory = { id: string; name: string };

// Yeni gider kaydı. "Şimdi ödendi" işaretlenirse gider PAID olarak kaydedilir
// ve seçilen kasa/banka bakiyesinden düşer; işaretlenmezse PENDING (planlanan
// borç) olarak durur, bakiyeyi etkilemez (bkz. schema > ExpenseStatus).
export function ExpenseModal({
  isOpen,
  onClose,
  categories,
  accounts,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  accounts: AccountRow[];
  onCreated: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [payNow, setPayNow] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCategoryId(categories[0]?.id ?? "");
    setTitle("");
    setVendorName("");
    setAmount("");
    setDueDate("");
    setPayNow(true);
    setAccountId(accounts[0]?.id ?? "");
  }, [isOpen, categories, accounts]);

  async function handleSubmit() {
    const value = Number(amount);
    if (!categoryId) return showError("Bir kategori seçin.");
    if (!title.trim()) return showError("Gider adı girin.");
    if (!Number.isFinite(value) || value <= 0) return showError("Geçerli bir tutar girin.");
    if (payNow && !accountId) return showError("Ödenen giderde kasa/banka hesabı seçmelisiniz.");

    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          title: title.trim(),
          vendorName: vendorName.trim() || undefined,
          amount: value,
          dueDate: dueDate || undefined,
          payNow,
          accountId: payNow ? accountId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error);
      }
      showSuccess(payNow ? "Gider ödenmiş olarak kaydedildi." : "Gider kaydedildi.");
      onCreated();
      onClose();
    } catch (err) {
      showError(err instanceof Error && err.message ? err.message : "Gider kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-rose-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Gider" variant="center" widthClassName="max-w-sm">
      <div className="space-y-3.5">
        {/* TUTAR şablona girmez — her ay değişir ve şablondan gelen bir
            rakam gözden kaçıp yanlış tutarla gider kaydına yol açar.
            Şablon "ne" olduğunu taşır, "ne kadar" olduğunu değil. */}
        <TemplateBar
          module="EXPENSE"
          onApply={(p) => {
            if (typeof p.title === "string") setTitle(p.title);
            // categoryHint: şablon kategori ID'si taşıyamaz (kurumdan
            // kuruma değişir), adına göre eşleşen varsa seçilir.
            if (typeof p.categoryHint === "string") {
              const hint = p.categoryHint.toLocaleLowerCase("tr-TR");
              const match = categories.find((c) => c.name.toLocaleLowerCase("tr-TR").includes(hint));
              if (match) setCategoryId(match.id);
            }
          }}
          getCurrent={() => {
            if (!title.trim()) return null;
            const cat = categories.find((c) => c.id === categoryId);
            return { title: title.trim(), categoryHint: cat?.name ?? undefined, vendorName: vendorName.trim() || undefined };
          }}
        />
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

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Gider Adı</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Eylül Elektrik Faturası" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Tutar (₺)</label>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Son Ödeme</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Tedarikçi (opsiyonel)</label>
          <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="BEDAŞ" className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setPayNow(true)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
              payNow ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50"
            )}
          >
            Ödendi
          </button>
          <button
            onClick={() => setPayNow(false)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-xs font-medium transition",
              !payNow ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50"
            )}
          >
            Bekliyor
          </button>
        </div>

        {payNow && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Ödenen Hesap</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputClass}>
              {accounts.length === 0 && <option value="">Önce bir kasa/banka hesabı ekleyin</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Gideri Kaydet
        </button>
      </div>
    </Modal>
  );
}
