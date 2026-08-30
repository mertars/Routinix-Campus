"use client";

import { useState } from "react";
import { LineChart, CheckCircle2, AlertTriangle, MinusCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type TestedSubtopic = { subtopicId: string; name: string; masteryScore: number };

function scoreTextColor(score: number): string {
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

// Faz U — "Ortalama" rozeti artık sadece bir sayı GÖSTERMİYOR, tıklanınca
// o ortalamanın NEDEN o sayı olduğunu açıklayan bir döküm açıyor (bkz.
// kullanıcının "daha detaylı istatistik görünümü" isteği) — %72 gibi TEK
// bir sayı "her konu dengeli %72" ile "yarısı %100 yarısı %44" arasındaki
// FARKI hiç göstermiyordu, bu görünüm o farkı açık ediyor. Zaten var olan
// "Gelişim Grafikleri" trend modalına (bkz. MasteryTrendDrilldown) tek
// tıkla geçiş sağlar — İKİ AYRI, kopuk "detay" ekranı yerine BİRBİRİNE
// BAĞLI tek bir akış.
export function XrayAverageDetailButton({
  averageScore,
  tested,
  onOpenTrend,
}: {
  averageScore: number;
  tested: TestedSubtopic[];
  onOpenTrend: () => void;
}) {
  const [open, setOpen] = useState(false);

  const strong = tested.filter((s) => s.masteryScore >= 60);
  const mid = tested.filter((s) => s.masteryScore >= 30 && s.masteryScore < 60);
  const weak = tested.filter((s) => s.masteryScore < 30);
  const sorted = [...tested].sort((a, b) => a.masteryScore - b.masteryScore);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sm font-bold transition hover:bg-sky-500/20",
          scoreTextColor(averageScore)
        )}
        aria-label="Ortalama detayını gör"
        title="Detaylı istatistik görünümü"
      >
        %{averageScore}
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Ortalama Detayı" variant="center" widthClassName="max-w-md">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-sky-500/5 p-4 dark:bg-sky-400/10">
            <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-lg font-bold dark:bg-midnight-card", scoreTextColor(averageScore))}>
              %{averageScore}
            </div>
            <p className="text-xs leading-relaxed text-espresso-muted dark:text-cream/50">
              {tested.length} konunun ortalaması. Aşağıda bu ortalamayı oluşturan konuların dağılımını görebilirsin — tek bir sayı, dengeli bir seviyeyi de,
              uçlarda dağılmış bir seviyeyi de gizleyebilir.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-center dark:bg-emerald-500/10">
              <CheckCircle2 className="mx-auto mb-1 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{strong.length}</p>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/60">Güçlü (60+)</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-2.5 text-center dark:bg-amber-500/10">
              <MinusCircle className="mx-auto mb-1 h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{mid.length}</p>
              <p className="text-[10px] text-amber-700/70 dark:text-amber-400/60">Orta (30-59)</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-2.5 text-center dark:bg-rose-500/10">
              <AlertTriangle className="mx-auto mb-1 h-4 w-4 text-rose-600 dark:text-rose-400" />
              <p className="text-lg font-bold text-rose-700 dark:text-rose-400">{weak.length}</p>
              <p className="text-[10px] text-rose-700/70 dark:text-rose-400/60">Kırmızı (&lt;30)</p>
            </div>
          </div>

          <div className="h-2.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
            <div className="flex h-full">
              {strong.length > 0 && <div className="h-full bg-emerald-500" style={{ width: `${(strong.length / tested.length) * 100}%` }} />}
              {mid.length > 0 && <div className="h-full bg-amber-500" style={{ width: `${(mid.length / tested.length) * 100}%` }} />}
              {weak.length > 0 && <div className="h-full bg-rose-500" style={{ width: `${(weak.length / tested.length) * 100}%` }} />}
            </div>
          </div>

          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {sorted.map((s) => (
              <div key={s.subtopicId} className="flex items-center justify-between rounded-lg bg-cream-card px-3 py-1.5 text-xs dark:bg-white/5">
                <span className="min-w-0 truncate text-espresso dark:text-cream">{s.name}</span>
                <span className={cn("shrink-0 font-semibold", scoreTextColor(s.masteryScore))}>%{s.masteryScore}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              setOpen(false);
              onOpenTrend();
            }}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            <LineChart className="h-4 w-4" /> Detaylı Gelişim Grafiklerini Gör
          </button>
        </div>
      </Modal>
    </>
  );
}
