"use client";

import { useState } from "react";
import { Loader2, CalendarPlus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

// Toplu taksit planı — kullanıcı geri bildirimi: yarın demo var, öğrenci
// başına tek tek taksit girmek yerine "toplam tutar + taksit sayısı" ile
// bir öğrencinin TÜM yıllık planını tek işlemde oluşturabilmeli (bkz.
// /api/payments/principal/installments POST > installmentCount dalı).
export function InstallmentPlanModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName: string;
  onCreated: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("12");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [titlePrefix, setTitlePrefix] = useState("Eğitim Ücreti");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!studentId) return;
    const amount = Number(totalAmount);
    const count = Number(installmentCount);
    if (!Number.isFinite(amount) || amount <= 0) return showError("Geçerli bir toplam tutar girin.");
    if (!Number.isInteger(count) || count < 1 || count > 36) return showError("Taksit sayısı 1-36 arası olmalı.");

    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/installments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, totalAmount: amount, installmentCount: count, startDate, titlePrefix: titlePrefix.trim() || undefined }),
      });
      if (!res.ok) throw new Error();
      showSuccess(`${count} taksitlik plan oluşturuldu.`);
      onCreated();
      onClose();
    } catch {
      showError("Plan oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Taksit Planı Oluştur — ${studentName}`} variant="center" widthClassName="max-w-sm">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Toplam Tutar (₺)</label>
          <input
            type="number"
            inputMode="decimal"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="120000"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Taksit Sayısı</label>
            <input
              type="number"
              inputMode="numeric"
              value={installmentCount}
              onChange={(e) => setInstallmentCount(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">İlk Vade</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Plan Adı</label>
          <input
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            placeholder="Eğitim Ücreti"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
          <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">
            Her taksit &quot;{titlePrefix || "Eğitim Ücreti"} - Taksit N/M&quot; olarak adlandırılır.
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Planı Oluştur
        </button>
      </div>
    </Modal>
  );
}
