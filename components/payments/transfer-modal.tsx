"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeftRight, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

type TransferRow = { id: string; fromName: string; toName: string; amount: number; transferredAt: string; note: string | null };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Hesaplar arası virman — gelir/gider DEĞİLDİR, toplam bakiyeyi değiştirmez
// (bkz. prisma/schema.prisma > AccountTransfer gerekçesi).
export function TransferModal({
  isOpen,
  onClose,
  accounts,
  onTransferred,
}: {
  isOpen: boolean;
  onClose: () => void;
  accounts: AccountRow[];
  onTransferred: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<TransferRow[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFromId(accounts[0]?.id ?? "");
    setToId(accounts[1]?.id ?? "");
    setAmount("");
    setNote("");
    fetch("/api/payments/principal/transfers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setHistory(d.transfers ?? []))
      .catch(() => setHistory([]));
  }, [isOpen, accounts]);

  const source = accounts.find((a) => a.id === fromId);

  async function submit() {
    const value = Number(amount);
    if (!fromId || !toId) return showError("Kaynak ve hedef hesap seçin.");
    if (fromId === toId) return showError("Kaynak ve hedef hesap aynı olamaz.");
    if (!Number.isFinite(value) || value <= 0) return showError("Geçerli bir tutar girin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAccountId: fromId, toAccountId: toId, amount: value, note: note.trim() || undefined }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess("Virman kaydedildi.");
      onTransferred();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Virman yapılamadı.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hesaplar Arası Virman" variant="center" widthClassName="max-w-sm">
      <div className="space-y-3.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Kaynak</label>
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <ArrowRight className="mb-3 h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/40" />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Hedef</label>
            <select value={toId} onChange={(e) => setToId(e.target.value)} className={inputClass}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Tutar (₺)</label>
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          {source && <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">Kaynak bakiye: {formatTRY(source.balance)}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Açıklama (opsiyonel)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Günlük kasa yatırımı" className={inputClass} />
        </div>

        <p className="rounded-xl border border-hairline px-3 py-2 text-[10px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
          Virman gelir ya da gider değildir — toplam bakiyeyi değiştirmez, yalnızca hesaplar arasında taşır.
        </p>

        <button
          onClick={submit}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />} Virmanı Kaydet
        </button>

        {history && history.length > 0 && (
          <div className="border-t border-hairline pt-3 dark:border-white/5">
            <p className="mb-2 text-[11px] font-semibold text-espresso-muted dark:text-cream/40">Son Virmanlar</p>
            <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
              {history.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                  <span className="min-w-0 truncate text-espresso-muted dark:text-cream/40">
                    {t.fromName} → {t.toName} · {new Date(t.transferredAt).toLocaleDateString("tr-TR")}
                  </span>
                  <span className="shrink-0 font-semibold text-espresso dark:text-cream">{formatTRY(t.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
