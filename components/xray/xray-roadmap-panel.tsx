"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Frame, ChevronRight } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Severity = "critical" | "moderate" | "strong";
type Recommendation = { subtopicId: string; name: string; masteryScore: number; severity: Severity; advice: string };
type Summary = { averageScore: number; criticalCount: number; moderateCount: number; strongCount: number; overallAdvice: string };
type RoadmapResponse = { subject: string; summary: Summary; recommendations: Recommendation[] };

const SEVERITY_META: Record<Severity, { label: string; dot: string; badge: string }> = {
  critical: { label: "Kritik", dot: "bg-rose-500", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  moderate: { label: "Orta", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  strong: { label: "İyi", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

const VISIBLE_COUNT = 5;
const PREVIEW_COUNT = 2;

// Faz Q — kullanıcı talebi: reçete motorunun (lib/server/xray/
// recommendations.ts) çıktısı yöneticiye ŞİMDİYE KADAR SADECE PDF indirerek
// görünüyordu — bu panel AYNI veriyi (yeni /api/xray/roadmap/[studentId])
// EKRANDA, RESMİ dilde (advice/overallAdvice — studioNote/studioSummary
// DEĞİL, o SADECE öğrenci ekranındadır, bkz. xray-roadmap-card.tsx)
// gösterir. "Bulgu Kareleri" — röntgen/fotoğrafçılık teması: her tespit
// tek bir "kare".
//
// Faz "menü düzenlemesi" — `compact` (SADECE canAssign sağ sütununda
// kullanılır): tam listeyi değil, en önemli 1-2 bulguyu gösteren küçük,
// tıklanabilir bir önizleme kartı basar; tıklanınca AYNI içerik (advice +
// tam liste) bir Modal içinde açılır. `compact` verilmezse (öğretmen
// tarafı) davranış eskisiyle BİREBİR AYNI — tam liste doğrudan sayfada.
export function XrayRoadmapPanel({ studentId, subject, compact = false }: { studentId: string; subject: string; compact?: boolean }) {
  const [data, setData] = useState<RoadmapResponse | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setData(null);
    setShowAll(false);
    setModalOpen(false);
    fetch(`/api/xray/roadmap/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((json) => setData(json))
      .catch(() => setData(null));
  }, [studentId, subject]);

  if (!data || data.recommendations.length === 0) return null;
  const visible = showAll ? data.recommendations : data.recommendations.slice(0, VISIBLE_COUNT);

  const body = (
    <>
      <p className="mb-3 text-xs leading-relaxed text-espresso-muted dark:text-cream/40">{data.summary.overallAdvice}</p>
      <div className="space-y-2">
        {visible.map((r) => {
          const meta = SEVERITY_META[r.severity];
          return (
            <div key={r.subtopicId} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                  <span className="truncate">{r.name}</span>
                </span>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.badge)}>
                  {meta.label} · %{r.masteryScore}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">{r.advice}</p>
            </div>
          );
        })}
      </div>
      {data.recommendations.length > VISIBLE_COUNT && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2.5 text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400">
          {showAll ? "Daha az göster" : `Tümünü göster (${data.recommendations.length})`}
        </button>
      )}
    </>
  );

  if (compact) {
    const preview = data.recommendations.slice(0, PREVIEW_COUNT);
    const remaining = data.recommendations.length - preview.length;
    return (
      <>
        {/* Kullanıcı geri bildirimi — sağ sütunun sabit alt bölümünde bu
            kart eski (küçük) boyutuyla altındaki boşluğu doldurmuyordu.
            Önizleme adedi (2) AYNI kaldı — sadece kart/satırlar büyüdü ve
            her bulguya kısa bir öneri satırı eklendi, boşluk anlamlı
            içerikle dolsun diye. */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setModalOpen(true)}
          className="group w-full rounded-3xl border border-hairline bg-white/70 p-5 text-left shadow-sm backdrop-blur-sm transition hover:scale-[1.015] hover:border-sky-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <Frame className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Bulgu Kareleri
            </h2>
            <ChevronRight className="h-4 w-4 shrink-0 text-espresso-muted transition group-hover:translate-x-0.5 dark:text-cream/40" />
          </div>
          <div className="space-y-2">
            {preview.map((r) => {
              const meta = SEVERITY_META[r.severity];
              return (
                <div key={r.subtopicId} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                      <span className="truncate">{r.name}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.badge)}>
                      {meta.label} · %{r.masteryScore}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">{r.advice}</p>
                </div>
              );
            })}
          </div>
          {remaining > 0 && <p className="mt-2.5 text-[11px] font-medium text-sky-600 dark:text-sky-400">+{remaining} bulgu daha — tümünü gör</p>}
        </motion.button>
        <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Bulgu Kareleri" variant="center" widthClassName="max-w-lg">
          {body}
        </Modal>
      </>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
    >
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Frame className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Bulgu Kareleri
      </h2>
      {body}
    </motion.div>
  );
}
