"use client";

import { useEffect, useState } from "react";
import { Loader2, UserMinus, AlertTriangle, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import type { AccountRow } from "@/components/payments/payments-principal-panel";

type Preview = {
  studentName: string;
  alreadyCancelled: { id: string; at: string } | null;
  openCount: number;
  remainingDebt: number;
  totalPaid: number;
  planTotal: number;
  totalMonths: number;
  elapsedMonths: number;
  consumed: number;
  suggestedRefund: number;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Kayıt iptali & iade. İade önerisi ŞEFFAF gösterilir (hangi orandan, hangi
// tutardan çıktı) — yönetici rakamı ezebilir, çünkü kesinti/cayma politikası
// kurumdan kuruma değişir.
export function CancellationModal({
  isOpen,
  onClose,
  studentId,
  accounts,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  accounts: AccountRow[];
  onDone: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [refund, setRefund] = useState("");
  const [accountId, setAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !studentId) return;
    setPreview(null);
    setReason("");
    fetch(`/api/payments/principal/cancellation?studentId=${encodeURIComponent(studentId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: Preview) => {
        setPreview(d);
        setRefund(d.suggestedRefund > 0 ? String(d.suggestedRefund) : "0");
        setAccountId(accounts[0]?.id ?? "");
      })
      .catch(() => showError("İptal önizlemesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  async function submit() {
    if (!studentId || !preview) return;
    const value = Number(refund);
    if (!reason.trim()) return showError("İptal gerekçesi zorunludur.");
    if (!Number.isFinite(value) || value < 0) return showError("Geçerli bir iade tutarı girin.");
    if (value > 0 && !accountId) return showError("İade için kasa/banka hesabı seçin.");
    const secondWarning = preview.alreadyCancelled
      ? `\n\n⚠️ Bu öğrenci için ${new Date(preview.alreadyCancelled.at).toLocaleDateString("tr-TR")} tarihinde ZATEN bir iptal kaydı var. İKİNCİ bir iptal kaydedilecek.`
      : "";
    if (!window.confirm(`${preview.studentName} için kayıt iptal edilecek.\n\n${preview.openCount} açık taksit iptal olacak${value > 0 ? `, ${formatTRY(value)} iade yapılacak` : ""}.${secondWarning}\n\nOnaylıyor musunuz?`)) return;

    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          reason: reason.trim(),
          refundAmount: value,
          refundAccountId: value > 0 ? accountId : undefined,
          // Önizlemede zaten bir iptal kaydı gösteriliyorsa müdür bunu
          // görerek onaylamış olur. Çift tıklamada önizleme henüz
          // yenilenmediği için bayrak GÖNDERİLMEZ ve sunucu ikinciyi
          // reddeder — asıl koruma budur.
          confirmSecond: preview.alreadyCancelled ? true : undefined,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess(`Kayıt iptal edildi. ${d.cancelledCount} taksit kapatıldı${d.refundAmount > 0 ? `, ${formatTRY(d.refundAmount)} iade edildi` : ""}.`);
      onDone();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Kayıt iptal edilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-rose-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={preview ? `Kayıt İptali — ${preview.studentName}` : "Kayıt İptali"} variant="center" widthClassName="max-w-sm">
      {!preview ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="space-y-3.5">
          {preview.alreadyCancelled && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Bu öğrenci için {new Date(preview.alreadyCancelled.at).toLocaleDateString("tr-TR")} tarihinde zaten bir iptal kaydı var.
            </div>
          )}

          {/* İade hesabının şeffaf dökümü — rakam kara kutu olmasın */}
          <div className="rounded-xl border border-hairline bg-cream-card/50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-espresso dark:text-cream">
              <Info className="h-3.5 w-3.5" /> İade hesabı
            </p>
            <Row label="Plan toplamı" value={formatTRY(preview.planTotal)} />
            <Row label="Tahsil edilen" value={formatTRY(preview.totalPaid)} />
            <Row
              label={`Kullanılan (${preview.elapsedMonths}/${preview.totalMonths} ay)`}
              value={formatTRY(preview.consumed)}
            />
            <div className="mt-1.5 border-t border-hairline pt-1.5 dark:border-white/10">
              <Row label="Önerilen iade" value={formatTRY(preview.suggestedRefund)} strong />
            </div>
            <p className="mt-1.5 text-[10px] text-espresso-muted dark:text-cream/40">
              Öneri, geçen ay oranına göre hesaplanır. Kesinti/cayma politikanıza göre değiştirebilirsiniz.
            </p>
          </div>

          <div className="rounded-xl border border-rose-400/25 bg-rose-500/5 p-3 text-[11px] text-espresso dark:text-cream">
            <span className="font-semibold">{preview.openCount} açık taksit</span> iptal edilecek ({formatTRY(preview.remainingDebt)} borç silinir).
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">İade Tutarı (₺)</label>
              <input type="number" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">İade Hesabı</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={Number(refund) <= 0} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">İptal Gerekçesi</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Şehir değişikliği" className={inputClass} />
          </div>

          <p className="text-[10px] text-espresso-muted dark:text-cream/40">
            Bu işlem yalnızca finansal kaydı kapatır. Öğrencinin okul kaydını pasifleştirmek için ERP &gt; Kullanıcı Yönetimi ekranını kullanın.
          </p>

          <button
            onClick={submit}
            disabled={saving}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />} Kaydı İptal Et
          </button>
        </div>
      )}
    </Modal>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-espresso-muted dark:text-cream/50">{label}</span>
      <span className={strong ? "font-semibold text-espresso dark:text-cream" : "text-espresso dark:text-cream/80"}>{value}</span>
    </div>
  );
}
