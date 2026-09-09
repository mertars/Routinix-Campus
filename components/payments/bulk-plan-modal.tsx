"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { runChunked } from "@/lib/client/chunked-import";

type BulkStudent = { id: string; name: string; branchId: string; branchName: string; hasPlan: boolean };
type Branch = { id: string; name: string; grade: number };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Çok öğrenciye tek seferde taksit planı.
//
// Önceden "toplu plan" tek öğrenciye N taksit demekti; 200 öğrencilik bir
// kurumda modal 200 kez açılıyordu. Her öğrenci KENDİ indirimiyle
// hesaplanır — toplu atama kardeş/başarı indirimini ezmez.
export function BulkPlanModal({ isOpen, onClose, onDone }: { isOpen: boolean; onClose: () => void; onDone: () => void }) {
  const { showError, showSuccess } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [students, setStudents] = useState<BulkStudent[] | null>(null);
  const [branchFilter, setBranchFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("10");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [prefix, setPrefix] = useState("2026-2027 Eğitim Ücreti");
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; percent: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStudents(null);
    setSelected(new Set());
    fetch("/api/payments/principal/installments/bulk")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => {
        setBranches(d.branches ?? []);
        setStudents(d.students ?? []);
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const visible = useMemo(
    () => (students ?? []).filter((s) => !branchFilter || s.branchId === branchFilter),
    [students, branchFilter]
  );
  // Planı olanlar seçilemez — ikinci plan borcu ikiye katlardı.
  const selectable = visible.filter((s) => !s.hasPlan);
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) selectable.forEach((s) => next.delete(s.id));
    else selectable.forEach((s) => next.add(s.id));
    setSelected(next);
  }

  async function submit() {
    const total = Number(amount);
    const n = Number(count);
    if (selected.size === 0) return showError("En az bir öğrenci seçin.");
    if (!Number.isFinite(total) || total <= 0) return showError("Geçerli bir liste fiyatı girin.");
    if (!Number.isInteger(n) || n < 1) return showError("Taksit sayısı en az 1 olmalı.");
    if (!window.confirm(`${selected.size} öğrenciye ${n} taksitlik plan kurulacak.\n\nListe fiyatı: ${formatTRY(total)}\nİndirimler öğrenci bazında ayrıca uygulanır.\n\nOnaylıyor musunuz?`)) return;

    setSaving(true);
    setProgress(null);
    try {
      // PARÇA PARÇA gönderilir. Tek istekte 100 öğrenci 31 saniye
      // sürüyordu ve ekranda yalnızca dönen bir çember vardı; izin
      // verilen üst sınırda (500) bu süre zaman aşımına giderdi.
      // Parça büyüklüğü burada 20: her öğrenci için indirim hesabı +
      // N taksit satırı yazılıyor, öğrenci başına maliyet içe
      // aktarmadakinden yüksek.
      let createdCount = 0;
      const failures = await runChunked<string, { studentId: string; name: string; error: string }>(
        [...selected],
        20,
        async (chunk) => {
          const res = await fetch("/api/payments/principal/installments/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentIds: chunk,
              totalAmount: total,
              installmentCount: n,
              startDate,
              titlePrefix: prefix.trim() || undefined,
            }),
          });
          const d = await res.json().catch(() => null);
          if (!res.ok) throw new Error(d?.error);
          createdCount += d.createdCount ?? 0;
          return (d.failed ?? []) as { studentId: string; name: string; error: string }[];
        },
        setProgress
      );

      const extra = failures.length > 0 ? ` ${failures.length} öğrencide hata oluştu.` : "";
      showSuccess(`${createdCount} öğrenciye plan kuruldu.${extra}`);
      onDone();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Toplu plan kurulamadı.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Toplu Taksit Planı" variant="center" widthClassName="max-w-lg">
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Liste Fiyatı (₺)</label>
            <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Taksit Sayısı</label>
            <input type="number" min={1} max={36} value={count} onChange={(e) => setCount(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">İlk Vade</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Açıklama</label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Şube</label>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={inputClass}>
            <option value="">Tüm şubeler</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {!students ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button onClick={toggleAll} disabled={selectable.length === 0} className="text-xs font-semibold text-emerald-700 disabled:opacity-40 dark:text-emerald-300">
                {allSelected ? "Seçimi kaldır" : `Tümünü seç (${selectable.length})`}
              </button>
              <span className="text-[11px] text-espresso-muted dark:text-cream/40">{selected.size} seçili</span>
            </div>

            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-hairline p-2 dark:border-white/10">
              {visible.length === 0 ? (
                <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Bu şubede öğrenci yok.</p>
              ) : (
                visible.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-1.5",
                      s.hasPlan ? "opacity-50" : "cursor-pointer hover:bg-cream-card dark:hover:bg-white/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      disabled={s.hasPlan}
                      checked={selected.has(s.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(s.id);
                        else next.delete(s.id);
                        setSelected(next);
                      }}
                      className="h-3.5 w-3.5 accent-emerald-600"
                    />
                    <span className="min-w-0 flex-1 truncate text-xs text-espresso dark:text-cream">{s.name}</span>
                    <span className="shrink-0 text-[10px] text-espresso-muted dark:text-cream/40">{s.branchName}</span>
                    {s.hasPlan && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-2.5 w-2.5" /> planı var
                      </span>
                    )}
                  </label>
                ))
              )}
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/5 p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Planı olan öğrenciler seçilemez — ikinci bir plan borcu iki katına çıkarırdı. Her öğrencinin kendi indirimi
              ayrıca uygulanır.
            </div>

            {/* Borç yazmak uzun sürer; müdür "dondu mu?" diye sayfayı
                yenilerse yarım kalmış bir plan kümesiyle karşılaşır. */}
            {progress && (
              <div className="mb-2">
                <div className="mb-1 flex justify-between text-[11px] text-espresso-muted dark:text-cream/40">
                  <span>Planlar kuruluyor...</span>
                  <span>
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            )}
            <button
              onClick={submit}
              disabled={saving || selected.size === 0}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              {selected.size} Öğrenciye Plan Kur
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
