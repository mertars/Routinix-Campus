"use client";

import { useEffect, useState } from "react";
import { Loader2, HandCoins, Banknote, Landmark, CreditCard } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { PaymentMethod } from "@prisma/client";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

const METHODS: { id: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { id: "CASH", label: "Nakit", icon: Banknote },
  { id: "BANK_TRANSFER", label: "Havale/EFT", icon: Landmark },
  { id: "CREDIT_CARD", label: "Kredi Kartı", icon: CreditCard },
];

const REMEMBER_KEY = "routinix.payments.lastCollect";

type Remembered = { method?: PaymentMethod; accountId?: string };

// localStorage her ortamda erişilebilir değil (gizli sekme, site verisi
// kapalı) ve erişim denemesi HATA FIRLATABİLİR — okuma/yazma sarmalanır,
// başarısız olursa varsayılana düşülür.
function readRemembered(): Remembered {
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    return raw ? (JSON.parse(raw) as Remembered) : {};
  } catch {
    return {};
  }
}

function writeRemembered(value: Remembered) {
  try {
    window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(value));
  } catch {
    // Hatırlamamak tahsilatı engellemez.
  }
}

export function CollectPaymentModal({
  isOpen,
  onClose,
  installmentId,
  installmentTitle,
  remainingAmount,
  accounts,
  onCollected,
}: {
  isOpen: boolean;
  onClose: () => void;
  installmentId: string | null;
  installmentTitle: string;
  remainingAmount: number;
  accounts: AccountRow[];
  onCollected: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : "");
    // Yöntem ve hesap günde onlarca tahsilatta neredeyse HEP aynı; her
    // seferinde yeniden seçtirmek boşuna iki tıklama. Son kullanılan
    // tarayıcıda saklanır — kuruma değil KİŞİYE ait bir kolaylık olduğu
    // için sunucuya yazılmıyor.
    const remembered = readRemembered();
    setMethod(remembered.method ?? "CASH");
    // Hatırlanan hesap silinmiş/pasifleşmiş olabilir; listede yoksa
    // ilkine düşülür, aksi halde boş bir seçim kalırdı.
    const validAccount = accounts.some((a) => a.id === remembered.accountId) ? remembered.accountId : null;
    setAccountId(validAccount ?? accounts[0]?.id ?? "");
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, installmentId, accounts]);

  async function handleSubmit() {
    if (!installmentId) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return showError("Geçerli bir tutar girin.");
    if (!accountId) return showError("Bir kasa/banka hesabı seçin.");

    setSaving(true);
    try {
      const res = await fetch(`/api/payments/principal/installments/${encodeURIComponent(installmentId)}/collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method, accountId, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error);
      }
      // Başarılı olduktan SONRA hatırla — reddedilen bir denemenin
      // seçimini varsayılan yapmak yanlış olurdu.
      writeRemembered({ method, accountId });
      showSuccess("Tahsilat kaydedildi.");
      onCollected();
      onClose();
    } catch (err) {
      showError(err instanceof Error && err.message ? err.message : "Tahsilat kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Tahsilat Kaydet — ${installmentTitle}`} variant="center" widthClassName="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Tutar (₺)</label>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
          <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">Kalan bakiye: {remainingAmount.toFixed(2)} ₺</p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Ödeme Yöntemi</label>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition",
                  method === m.id ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
                )}
              >
                <m.icon className="h-4 w-4" /> {m.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Yatırılan Hesap</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {accounts.length === 0 && <option value="">Önce bir kasa/banka hesabı ekleyin</option>}
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Not (opsiyonel)</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || accounts.length === 0}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
          Tahsilatı Kaydet
        </button>
      </div>
    </Modal>
  );
}
