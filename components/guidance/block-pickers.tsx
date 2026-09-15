"use client";

import { useMemo, useState } from "react";
import { Check, PlayCircle, Scan, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// BLOK SEÇİCİLERİ — video ve röntgen konusu için pop-up seçim ekranları.
//
// ⚠️ NEDEN (Mert, 2026-09-15): "bu özellikler için pop-up pencere açılsın,
// liste değil de daha rahat bir ekrandan seçim yapılsın". Küçük bir blok
// kartının içindeki <select>, 200 videoluk bir kütüphanede ya da 75
// kazanımlı bir müfredatta seçim yapmaya elverişli değil — başlıklar
// kırpılıyor, arama yok, ders/sınıf bilgisi görünmüyor.
// ----------------------------------------------------------------------------

export type VideoOption = { id: string; title: string; subject: string; topic: string; grade: number };
export type SubtopicOption = { subject: string; subtopicId: string; name: string; score?: number };

export function VideoPickerModal({
  isOpen,
  onClose,
  videos,
  selectedId,
  preferredSubject,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoOption[];
  selectedId: string | null;
  /** Bloğun dersi — o dersin videoları başa alınır, diğerleri gizlenmez. */
  preferredSubject?: string;
  onPick: (video: VideoOption) => void;
}) {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const filtered = q
      ? videos.filter(
          (v) =>
            v.title.toLocaleLowerCase("tr-TR").includes(q) ||
            v.subject.toLocaleLowerCase("tr-TR").includes(q) ||
            v.topic.toLocaleLowerCase("tr-TR").includes(q)
        )
      : videos;
    // Bloğun dersiyle eşleşenler ÖNCE — gizlemek yerine sıralamak doğru:
    // rehber bilerek başka bir dersin videosunu verebilir.
    if (!preferredSubject) return filtered;
    return [...filtered].sort((a, b) => Number(b.subject === preferredSubject) - Number(a.subject === preferredSubject));
  }, [videos, query, preferredSubject]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Video Seç">
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-muted dark:text-cream/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Video, ders veya konu ara..."
          className="min-h-[44px] w-full rounded-xl border border-hairline bg-white pl-10 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>

      {videos.length === 0 ? (
        <p className="rounded-xl bg-cream-card px-3 py-8 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          Kurumun video kütüphanesinde yayına hazır video yok.
        </p>
      ) : (
        <div className="max-h-[22rem] space-y-1.5 overflow-y-auto">
          {list.map((v) => {
            const active = v.id === selectedId;
            return (
              <button
                key={v.id}
                onClick={() => {
                  onPick(v);
                  onClose();
                }}
                className={cn(
                  "flex min-h-[52px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-hairline hover:bg-cream-card dark:border-white/10 dark:hover:bg-white/5"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                  <PlayCircle className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-espresso dark:text-cream">{v.title}</span>
                  <span className="block truncate text-[11px] text-espresso-muted dark:text-cream/45">
                    {v.subject} · {v.topic} · {v.grade}. sınıf
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-espresso-muted dark:text-cream/40">Aramaya uyan video yok.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

export function SubtopicPickerModal({
  isOpen,
  onClose,
  subtopics,
  selectedId,
  onPick,
}: {
  isOpen: boolean;
  onClose: () => void;
  subtopics: SubtopicOption[];
  selectedId: string | null;
  onPick: (s: SubtopicOption) => void;
}) {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return subtopics;
    return subtopics.filter(
      (s) => s.name.toLocaleLowerCase("tr-TR").includes(q) || s.subject.toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [subtopics, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Röntgen Konusu Seç">
      <p className="mb-3 rounded-xl bg-sky-50 px-3 py-2 text-[11.5px] leading-snug text-sky-800 dark:bg-sky-500/10 dark:text-sky-200">
        Seçtiğiniz konudan öğrenciye <span className="font-semibold">gerçek bir röntgen testi atanır</span>; çözüp
        çözmediğini programda görürsünüz. Soru havuzunda içeriği olmayan konularda atama yapılmaz.
      </p>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-muted dark:text-cream/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Kazanım veya ders ara..."
          className="min-h-[44px] w-full rounded-xl border border-hairline bg-white pl-10 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>

      {subtopics.length === 0 ? (
        <p className="rounded-xl bg-cream-card px-3 py-8 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          Bu öğrenci için kazanım listesi yok — Röntgen testi çözülmemiş.
        </p>
      ) : (
        <div className="max-h-[22rem] space-y-1.5 overflow-y-auto">
          {list.map((s) => {
            const active = s.subtopicId === selectedId;
            return (
              <button
                key={s.subtopicId}
                onClick={() => {
                  onPick(s);
                  onClose();
                }}
                className={cn(
                  "flex min-h-[48px] w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                  active
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-hairline hover:bg-cream-card dark:border-white/10 dark:hover:bg-white/5"
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  <Scan className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-espresso dark:text-cream">{s.name}</span>
                  <span className="block truncate text-[11px] text-espresso-muted dark:text-cream/45">{s.subject}</span>
                </span>
                {typeof s.score === "number" && (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      s.score < 40
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        : s.score < 70
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                          : "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                    )}
                  >
                    %{s.score}
                  </span>
                )}
                {active && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            );
          })}
          {list.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-espresso-muted dark:text-cream/40">Aramaya uyan kazanım yok.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
