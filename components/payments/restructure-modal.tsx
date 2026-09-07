"use client";

import { useEffect, useState } from "react";
import { Loader2, Layers, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Kalan borcu yeni bir plana bölme. Eski açık taksitler KAPATILIR, kalan
// tutar yeniden bölünür (bkz. restructure route'undaki "neden kapat +
// yeniden oluştur" gerekçesi).
export function RestructureModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName: string;
  onDone: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [preview, setPreview] = useState<{ openCount: number; remainingAmount: number } | null>(null);
  const [count, setCount] = useState("6");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !studentId) return;
    setPreview(null);
    setReason("");
    fetch(`/api/payments/principal/restructure?studentId=${encodeURIComponent(studentId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setPreview(d))
      .catch(() => showError("Yapılandırma önizlemesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  async function submit() {
    const n = Number(count);
    if (!studentId) return;
    if (!Number.isInteger(n) || n < 1 || n > 36) return showError("Taksit sayısı 1-36 arası olmalı.");
    if (!reason.trim()) return showError("Yapılandırma gerekçesi zorunludur.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/restructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, installmentCount: n, startDate, reason: reason.trim() }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showSuccess(`${d.closedCount} taksit kapatıldı, ${formatTRY(d.restructuredAmount)} ${d.newCount} taksite bölündü.`);
      onDone();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Yapılandırma yapılamadı.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";
  const perInstallment = preview && Number(count) > 0 ? preview.remainingAmount / Number(count) : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Borç Yapılandırma — ${studentName}`} variant="center" widthClassName="max-w-sm">
      {!preview ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : preview.openCount === 0 ? (
        <p className="py-8 text-center text-sm text-espresso-muted dark:text-cream/40">Yapılandırılacak açık taksit yok.</p>
      ) : (
        <div className="space-y-3.5">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> {preview.openCount} açık taksit kapatılacak
            </p>
            <p className="mt-1 text-[11px] text-espresso-muted dark:text-cream/50">
              Kalan {formatTRY(preview.remainingAmount)} yeni plana bölünecek. Yapılmış tahsilatlar ve makbuzlar korunur.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Yeni Taksit Sayısı</label>
              <input type="number" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">İlk Vade</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          {perInstallment > 0 && (
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              Yeni taksit tutarı: yaklaşık <span className="font-semibold text-espresso dark:text-cream">{formatTRY(perInstallment)}</span> / ay
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Gerekçe</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Veli talebi — ödeme güçlüğü" className={inputClass} />
          </div>

          <button
            onClick={submit}
            disabled={saving}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />} Borcu Yapılandır
          </button>
        </div>
      )}
    </Modal>
  );
}
