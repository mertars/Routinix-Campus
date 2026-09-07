"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarPlus, BadgePercent } from "lucide-react";
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
  const [academicYear] = useState("2025-2026");
  const [saving, setSaving] = useState(false);
  // Girilen tutar LİSTE fiyatıdır; öğrencinin aktif indirimleri sunucuda
  // uygulanır. Yönetici "kaydet"e basmadan ÖNCE net tutarı görmeli, bu
  // yüzden aynı hesap canlı önizleniyor (aynı uç, aynı formül).
  const [preview, setPreview] = useState<{ listAmount: number; discountTotal: number; netAmount: number; rows: { label: string; amount: number }[] } | null>(null);

  useEffect(() => {
    const amount = Number(totalAmount);
    if (!isOpen || !studentId || !Number.isFinite(amount) || amount <= 0) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/payments/principal/discounts?studentId=${encodeURIComponent(studentId)}&academicYear=${encodeURIComponent(academicYear)}&listAmount=${amount}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((d) => setPreview(d.calculation))
        .catch(() => setPreview(null));
    }, 350);
    return () => clearTimeout(timer);
  }, [isOpen, studentId, totalAmount, academicYear]);

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
        body: JSON.stringify({ studentId, totalAmount: amount, installmentCount: count, startDate, titlePrefix: titlePrefix.trim() || undefined, academicYear }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json().catch(() => null);
      showSuccess(
        data?.discountTotal > 0
          ? `${count} taksitlik plan oluşturuldu. ${data.discountTotal.toLocaleString("tr-TR")} ₺ indirim uygulandı.`
          : `${count} taksitlik plan oluşturuldu.`
      );
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
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Liste Fiyatı (₺)</label>
          <input
            type="number"
            inputMode="decimal"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="120000"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>
        {preview && preview.discountTotal > 0 && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <BadgePercent className="h-3.5 w-3.5" /> İndirimler uygulanacak
            </p>
            {preview.rows.filter((r) => r.amount > 0).map((r) => (
              <div key={r.label} className="flex justify-between text-[11px] text-espresso-muted dark:text-cream/50">
                <span>{r.label}</span>
                <span>−{r.amount.toLocaleString("tr-TR")} ₺</span>
              </div>
            ))}
            <div className="mt-1.5 flex justify-between border-t border-emerald-500/20 pt-1.5 text-xs font-semibold text-espresso dark:text-cream">
              <span>Net tutar</span>
              <span>{preview.netAmount.toLocaleString("tr-TR")} ₺</span>
            </div>
          </div>
        )}

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
