"use client";

import { LineChart, CheckCircle2, AlertTriangle, MinusCircle, Send, History, ListTodo } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type TestedSubtopic = { subtopicId: string; name: string; masteryScore: number };
type AnySubtopic = { subtopicId: string; name: string; masteryScore: number | null };
type HistoryEvent = { assessedAt: string; subtopicId: string; subtopicName: string; masteryScore: number };

function scoreTextColor(score: number): string {
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

// Faz V — 4 istatistik kartının (Ortalama/Test Edilen Konu/Kırmızı Bölge/
// Son Değerlendirme) HER BİRİ için ayrı, odaklı bir detay modalı. Faz U'da
// YANLIŞLIKLA başlıktaki küçük rozet tıklanabilir yapılmıştı — kullanıcının
// GERÇEKTEN tıkladığı bu 4 kart olduğu DevTools ile doğrulandıktan sonra
// (bkz. commit yorumu) buraya taşındı. Hepsi CONTROLLED modal (isOpen/
// onClose parent'tan gelir) — xray-results-panel.tsx'teki StatCard'ların
// onClick'i bu state'leri açar.

export function XrayAverageDetailModal({
  isOpen,
  onClose,
  averageScore,
  tested,
  onOpenTrend,
}: {
  isOpen: boolean;
  onClose: () => void;
  averageScore: number;
  tested: TestedSubtopic[];
  onOpenTrend: () => void;
}) {
  const strong = tested.filter((s) => s.masteryScore >= 60);
  const mid = tested.filter((s) => s.masteryScore >= 30 && s.masteryScore < 60);
  const weak = tested.filter((s) => s.masteryScore < 30);
  const sorted = [...tested].sort((a, b) => a.masteryScore - b.masteryScore);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ortalama Detayı" variant="center" widthClassName="max-w-md">
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
            onClose();
            onOpenTrend();
          }}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-500"
        >
          <LineChart className="h-4 w-4" /> Detaylı Gelişim Grafiklerini Gör
        </button>
      </div>
    </Modal>
  );
}

export function XrayRedZoneModal({ isOpen, onClose, weak }: { isOpen: boolean; onClose: () => void; weak: TestedSubtopic[] }) {
  const sorted = [...weak].sort((a, b) => a.masteryScore - b.masteryScore);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Kırmızı Bölge" variant="center" widthClassName="max-w-md">
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Kırmızı bölgede konu yok — harika gidiyor.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-espresso-muted dark:text-cream/50">
            Skoru %30&apos;un altında olan {sorted.length} konu — temelden eksik tespit edildi, önceliklendirilmiş bir tekrar programı önerilir.
          </p>
          {sorted.map((s) => (
            <div key={s.subtopicId} className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2.5 text-xs dark:bg-rose-500/10">
              <span className="min-w-0 truncate font-medium text-rose-800 dark:text-rose-300">{s.name}</span>
              <span className="shrink-0 font-bold text-rose-700 dark:text-rose-400">%{s.masteryScore}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export function XrayUntestedTopicsModal({
  isOpen,
  onClose,
  untested,
  onAssign,
}: {
  isOpen: boolean;
  onClose: () => void;
  untested: AnySubtopic[];
  onAssign?: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Test Edilen Konular" variant="center" widthClassName="max-w-md">
      {untested.length === 0 ? (
        <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Bu derste tüm konular en az bir kez test edilmiş.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-espresso-muted dark:text-cream/50">Henüz hiç test edilmemiş {untested.length} konu:</p>
          <div className="max-h-56 space-y-1.5 overflow-y-auto">
            {untested.map((s) => (
              <div key={s.subtopicId} className="flex items-center gap-2 rounded-lg bg-cream-card px-3 py-2 text-xs text-espresso dark:bg-white/5 dark:text-cream">
                <ListTodo className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
                {s.name}
              </div>
            ))}
          </div>
          {onAssign && (
            <button
              onClick={() => {
                onClose();
                onAssign();
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              <Send className="h-4 w-4" /> Test Atama Panelini Aç
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export function XrayHistoryTimelineModal({ isOpen, onClose, events }: { isOpen: boolean; onClose: () => void; events: HistoryEvent[] }) {
  const sorted = [...events].sort((a, b) => (a.assessedAt < b.assessedAt ? 1 : -1));
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Değerlendirme Geçmişi" variant="center" widthClassName="max-w-md">
      {sorted.length === 0 ? (
        <p className="py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz bir değerlendirme kaydı yok.</p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto">
          {sorted.map((e, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-cream-card px-3 py-2 text-xs dark:bg-white/5">
              <History className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
              <span className="w-20 shrink-0 text-espresso-muted dark:text-cream/40">{new Date(e.assessedAt).toLocaleDateString("tr-TR")}</span>
              <span className="min-w-0 flex-1 truncate text-espresso dark:text-cream">{e.subtopicName}</span>
              <span className={cn("shrink-0 font-semibold", scoreTextColor(e.masteryScore))}>%{e.masteryScore}</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
