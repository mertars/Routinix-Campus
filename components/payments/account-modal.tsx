"use client";

import { useState } from "react";
import { Loader2, Plus, Wallet, Landmark } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { PaymentAccountType } from "@prisma/client";

// Yeni kasa/banka hesabı ekleme — kurum bazında sınırsız sayıda hesap
// olabilir (örn. birden fazla banka şubesi), bkz. plan dosyası.
export function AccountModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<PaymentAccountType>("CASH");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setType("CASH");
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      if (!res.ok) throw new Error();
      showSuccess("Hesap eklendi.");
      reset();
      onCreated();
      onClose();
    } catch {
      showError("Hesap eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Kasa/Banka Hesabı" variant="center" widthClassName="max-w-sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("CASH")}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition",
              type === "CASH" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            )}
          >
            <Wallet className="h-4 w-4" /> Nakit Kasa
          </button>
          <button
            onClick={() => setType("BANK")}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition",
              type === "BANK" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            )}
          >
            <Landmark className="h-4 w-4" /> Banka Hesabı
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Hesap Adı</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={type === "CASH" ? "Nakit Kasa" : "Ziraat Bankası TL Hesabı"}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim() || saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Hesabı Ekle
        </button>
      </div>
    </Modal>
  );
}
