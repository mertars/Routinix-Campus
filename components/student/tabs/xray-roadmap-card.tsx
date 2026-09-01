"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

type Severity = "critical" | "moderate" | "strong";
type Recommendation = { subtopicId: string; name: string; masteryScore: number; severity: Severity; advice: string };
type Summary = { averageScore: number; criticalCount: number; moderateCount: number; strongCount: number; overallAdvice: string };
type SubjectRoadmap = { subject: string; summary: Summary; recommendations: Recommendation[] };

const SEVERITY_META: Record<Severity, { label: string; dot: string; badge: string }> = {
  critical: { label: "Kritik", dot: "bg-rose-500", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  moderate: { label: "Orta", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  strong: { label: "İyi", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

const VISIBLE_COUNT = 5;

// Faz P — rakip araştırmasında ("Matematik Röntgeni") bulunan boşluğu
// kapatır: kural bazlı reçete motoru (lib/server/xray/recommendations.ts)
// ŞİMDİYE KADAR sadece indirilen PDF raporunda vardı, öğrenci "sırada ne
// çalışmalıyım" tavsiyesini kendi panelinde HİÇ görmüyordu. Bu kart,
// XraySelfProgressCard'ın ("Gelişimin" — SADECE trend) hemen yanında,
// AYNI veriyi (TopicMasteryAssessment) somut bir ÇALIŞMA ÖNERİSİNE çevirip
// gösterir — en zayıf konudan başlayarak sıralı, önceliklendirilmiş liste.
export function XrayRoadmapCard() {
  const [subjects, setSubjects] = useState<SubjectRoadmap[] | null>(null);
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch("/api/xray/my-roadmap")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        const list: SubjectRoadmap[] = (data.subjects ?? []).filter((s: SubjectRoadmap) => s.recommendations.length > 0);
        setSubjects(list);
        setActiveSubject((current) => current ?? list[0]?.subject ?? null);
      })
      .catch(() => setSubjects([]));
  }, []);

  if (!subjects || subjects.length === 0) return null;
  const active = subjects.find((s) => s.subject === activeSubject) ?? subjects[0];
  const visible = showAll ? active.recommendations : active.recommendations.slice(0, VISIBLE_COUNT);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-brand-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-brand-500/15 dark:bg-midnight-card/50"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Compass className="h-4 w-4 text-brand-600" /> Kişisel Çalışma Yol Haritan
        </h2>
        {subjects.length > 1 && (
          <select
            value={active.subject}
            onChange={(event) => {
              setActiveSubject(event.target.value);
              setShowAll(false);
            }}
            className="rounded-lg border border-hairline bg-white px-2 py-1 text-[11px] text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-3 text-xs leading-relaxed text-espresso-muted dark:text-cream/50">{active.summary.overallAdvice}</p>

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
              <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/50">{r.advice}</p>
            </div>
          );
        })}
      </div>

      {active.recommendations.length > VISIBLE_COUNT && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2.5 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400">
          {showAll ? "Daha az göster" : `Tümünü göster (${active.recommendations.length})`}
        </button>
      )}
    </motion.div>
  );
}
