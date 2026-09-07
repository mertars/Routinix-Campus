"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Percent, BadgePercent, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

export type StudentDiscountRow = { id: string; type: string; label: string; valueType: string; value: number };

const TYPES = [
  { id: "SIBLING", label: "Kardeş İndirimi" },
  { id: "MERIT", label: "Başarı Bursu" },
  { id: "EARLY_REGISTRATION", label: "Erken Kayıt" },
  { id: "STAFF_CHILD", label: "Personel Çocuğu" },
  { id: "FINANCIAL_AID", label: "İhtiyaç Bursu" },
  { id: "OTHER", label: "Diğer" },
];

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

// Bir öğrencinin indirim/burslarını yönetir. İndirimler taksit planı
// üretilirken otomatik uygulanır (bkz. installments route > applyDiscounts).
export function DiscountModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  academicYear,
  onChanged,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  studentName: string;
  academicYear: string;
  onChanged: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState<StudentDiscountRow[] | null>(null);
  const [type, setType] = useState("SIBLING");
  const [valueType, setValueType] = useState<"PERCENTAGE" | "FIXED">("PERCENTAGE");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    if (!studentId) return;
    fetch(`/api/payments/principal/discounts?studentId=${encodeURIComponent(studentId)}&academicYear=${encodeURIComponent(academicYear)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setRows(d.discounts ?? []))
      .catch(() => showError("İndirimler yüklenemedi."));
  }

  useEffect(() => {
    if (!isOpen || !studentId) return;
    setRows(null);
    setValue("");
    setReason("");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, studentId]);

  async function add() {
    const v = Number(value);
    if (!studentId) return;
    if (!Number.isFinite(v) || v <= 0) return showError("Geçerli bir değer girin.");
    if (valueType === "PERCENTAGE" && v > 100) return showError("Yüzde 100'den büyük olamaz.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, type, valueType, value: v, academicYear, reason: reason.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("İndirim tanımlandı.");
      setValue("");
      setReason("");
      load();
      onChanged();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "İndirim eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch("/api/payments/principal/discounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      load();
      onChanged();
    } else showError("İndirim kaldırılamadı.");
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${studentName} — İndirim & Burs`} variant="center" widthClassName="max-w-md">
      <div className="space-y-4">
        {!rows ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-hairline py-5 text-center text-xs text-espresso-muted dark:border-white/15 dark:text-cream/40">
            Bu öğrenci için {academicYear} yılında indirim tanımlı değil.
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-espresso dark:text-cream">{d.label}</span>
                  <span className="block text-[10px] text-espresso-muted dark:text-cream/40">
                    {d.valueType === "PERCENTAGE" ? `%${d.value}` : formatTRY(d.value)}
                  </span>
                </span>
                <button
                  onClick={() => remove(d.id)}
                  aria-label="İndirimi kaldır"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-espresso-muted transition hover:bg-rose-500/10 hover:text-rose-600 dark:text-cream/40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-hairline pt-4 dark:border-white/5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
            <BadgePercent className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Yeni İndirim
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Tür</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              {TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-2">
            <div className="flex overflow-hidden rounded-lg border border-hairline dark:border-white/10">
              <button
                onClick={() => setValueType("PERCENTAGE")}
                className={cn("px-3 py-2 text-xs font-medium transition", valueType === "PERCENTAGE" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "text-espresso-muted dark:text-cream/50")}
              >
                <Percent className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setValueType("FIXED")}
                className={cn("px-3 py-2 text-xs font-medium transition", valueType === "FIXED" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "text-espresso-muted dark:text-cream/50")}
              >
                ₺
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={valueType === "PERCENTAGE" ? "20" : "5000"}
              className={inputClass}
            />
          </div>

          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Gerekçe (opsiyonel)" className={inputClass} />

          <button
            onClick={add}
            disabled={saving}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} İndirimi Ekle
          </button>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">
            İndirimler taksit planı oluşturulurken otomatik uygulanır. Önce sabit tutarlar düşülür, sonra kalan üzerine yüzdeler işlenir.
          </p>
        </div>
      </div>
    </Modal>
  );
}
