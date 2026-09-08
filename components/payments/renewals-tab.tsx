"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, RefreshCw, AlertTriangle, Wand2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Candidate = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  branchName: string;
  academicYear: string;
  endDate: string;
  daysLeft: number;
  listAmount: number | null;
  installmentCount: number | null;
  openDebt: number;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// "Kayıt süresi bitiyor, devam edecek mi?" ekranı.
//
// Bu sekme olmadan kayıt dönemi verisi görünmez bir yerde duruyordu:
// süre doluyor, kimse haberdar olmuyordu. Liste, konuşmadan önce
// bilinmesi gerekeni birlikte gösterir — kaç gün kaldı, GEÇEN YIL ne
// ödedi ve HÂLÂ borcu var mı.
export function RenewalsTab() {
  const { showError, showSuccess } = useToast();
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [windowDays, setWindowDays] = useState(60);
  const [missingEnrollment, setMissingEnrollment] = useState(0);
  const [backfilling, setBackfilling] = useState(false);
  const [target, setTarget] = useState<Candidate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/enrollments?days=${windowDays}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yenileme listesi alınamadı.");
      setCandidates(data.candidates ?? []);
      setMissingEnrollment(data.missingEnrollment ?? 0);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yenileme listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [windowDays, showError]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBackfill() {
    setBackfilling(true);
    try {
      const res = await fetch("/api/enrollments?backfill=1", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "İşlem başarısız.");
      showSuccess(`${data.created} öğrenci için ${data.academicYear} kaydı oluşturuldu.`);
      await load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "İşlem başarısız.");
    } finally {
      setBackfilling(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Kayıt dönemi olmayan öğrenciler bu listede HİÇ görünmez —
          sayı sıfırdan büyükse sessizce eksik kalmak yerine söylenir. */}
      {missingEnrollment > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-300">
              {missingEnrollment} öğrencinin kayıt dönemi tanımlı değil
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/70">
              Bu öğrenciler yenileme listesinde hiç çıkmaz. Tek tuşla bu yılın kaydını oluşturabilirsiniz — ücret,
              mevcut taksitlerinden okunur, var olan kayıtlara dokunulmaz.
            </p>
          </div>
          <button
            onClick={runBackfill}
            disabled={backfilling}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
          >
            {backfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            Hepsi için oluştur
          </button>
        </div>
      )}

      <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm dark:border-white/10 dark:bg-midnight-card/50">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <CalendarClock className="h-4 w-4" /> Kayıt Yenileme
            </h2>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              {loading ? "Yükleniyor..." : `${candidates.length} öğrencinin kaydı ${windowDays} gün içinde bitiyor`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={windowDays}
              onChange={(e) => setWindowDays(Number(e.target.value))}
              className="rounded-xl border border-hairline bg-white px-3 py-1.5 text-xs text-espresso outline-none dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              <option value={30}>30 gün içinde</option>
              <option value={60}>60 gün içinde</option>
              <option value={120}>120 gün içinde</option>
              <option value={365}>Bu yıl içinde</option>
            </select>
            <button
              onClick={load}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Yenile
            </button>
          </div>
        </div>

        {!loading && candidates.length === 0 && (
          <p className="py-8 text-center text-xs text-espresso-muted dark:text-cream/40">
            Bu aralıkta süresi dolan kayıt yok.
          </p>
        )}

        <div className="space-y-2">
          {candidates.map((c) => (
            <div
              key={c.enrollmentId}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-cream-card p-3 dark:bg-white/5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">
                  {c.studentName}{" "}
                  <span className="text-[11px] font-normal text-espresso-muted dark:text-cream/40">
                    · {c.branchName} · No: {c.studentNumber}
                  </span>
                </p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                  {c.academicYear} · bitiş {new Date(c.endDate).toLocaleDateString("tr-TR")}
                  {c.listAmount != null && ` · geçen yıl ${formatTRY(c.listAmount)}`}
                  {c.installmentCount != null && ` (${c.installmentCount} taksit)`}
                </p>
              </div>

              {/* Açık borç, yenileme konuşmasından ÖNCE bilinmesi gereken şey. */}
              {c.openDebt > 0 && (
                <span className="rounded-lg bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
                  Geçen yıldan {formatTRY(c.openDebt)} borç
                </span>
              )}
              <span
                className={cn(
                  "rounded-lg px-2 py-1 text-[11px] font-medium",
                  c.daysLeft < 0
                    ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                    : c.daysLeft <= 15
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      : "bg-cream text-espresso-muted dark:bg-white/10 dark:text-cream/50"
                )}
              >
                {c.daysLeft < 0 ? `${Math.abs(c.daysLeft)} gün geçti` : `${c.daysLeft} gün kaldı`}
              </span>
              <button
                onClick={() => setTarget(c)}
                className="rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                Yenile
              </button>
            </div>
          ))}
        </div>
      </div>

      <RenewModal candidate={target} onClose={() => setTarget(null)} onDone={load} />
    </div>
  );
}

// Tek öğrencinin yenilenmesi. Geçen yılın ücreti ÖN DOLU gelir — müdür
// çoğu zaman sadece zam oranını değiştirir, sıfırdan yazmaz.
function RenewModal({
  candidate,
  onClose,
  onDone,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [amount, setAmount] = useState("");
  const [count, setCount] = useState("");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!candidate) return;
    setAmount(candidate.listAmount != null ? String(candidate.listAmount) : "");
    setCount(candidate.installmentCount != null ? String(candidate.installmentCount) : "");
    // Yeni dönem, biten dönemin bitişinin ertesi günü değil, bir sonraki
    // eğitim yılının Eylül'ü olarak önerilir.
    const endYear = Number(candidate.academicYear.split("-")[1]);
    setStartDate(`${endYear}-09-15`);
  }, [candidate]);

  async function submit() {
    if (!candidate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/enrollments/${candidate.enrollmentId}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          listAmount: amount ? Number(amount) : null,
          installmentCount: count ? Number(count) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yenilenemedi.");
      showSuccess(
        data.plan
          ? `${data.previousYear} → ${data.academicYear} yenilendi · ${data.plan.createdCount} taksit kuruldu.`
          : `${data.previousYear} → ${data.academicYear} yenilendi.`
      );
      onDone();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yenilenemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={!!candidate} onClose={onClose} title={candidate ? `${candidate.studentName} · Kayıt Yenile` : ""} variant="center">
      {candidate && (
        <div className="space-y-3">
          <div className="rounded-xl bg-cream-card p-3 text-[11px] text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            {candidate.academicYear} dönemi {new Date(candidate.endDate).toLocaleDateString("tr-TR")} tarihinde bitiyor.
            Geçmiş kayıt SİLİNMEZ, öğrenci numarası ({candidate.studentNumber}) değişmez.
            {candidate.openDebt > 0 && (
              <span className="mt-1 block font-medium text-red-600 dark:text-red-400">
                Dikkat: geçen yıldan {formatTRY(candidate.openDebt)} açık borcu var. Yeni plan bunun ÜSTÜNE eklenir.
              </span>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">Yeni dönem başlangıcı</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">
                Yeni yıl ücreti {candidate.listAmount != null && "(geçen yıl ön dolu)"}
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Boş = taksit planı kurulmaz"
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">Taksit</label>
              <input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
            </div>
          </div>

          {/* Zam kısayolları: müdür oranı elde hesaplamasın. */}
          {candidate.listAmount != null && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-espresso-muted dark:text-cream/40">Zam:</span>
              {[0, 10, 20, 25, 30, 40].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setAmount(String(Math.round((candidate.listAmount as number) * (1 + pct / 100))))}
                  className="rounded-lg border border-hairline px-2 py-1 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                >
                  {pct === 0 ? "Aynı" : `+%${pct}`}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl border border-hairline px-4 py-2 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <X className="h-3.5 w-3.5" /> Vazgeç
            </button>
            <button
              onClick={submit}
              disabled={submitting || !startDate}
              className="flex items-center gap-1.5 rounded-xl bg-espresso px-4 py-2 text-sm font-medium text-cream transition hover:bg-caramel disabled:opacity-40 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Yenile
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
