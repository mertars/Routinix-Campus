"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, LifeBuoy, CheckCheck, Loader2 } from "lucide-react";
import { RISK_REASON_LABEL, type RiskReason } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type RiskEntry = { id: string; name: string; branch: string; riskScore: number; reason: RiskReason };

const SIZE = 260;
const CENTER = SIZE / 2;
const MAX_RADIUS = CENTER - 24;
const RINGS = [1, 0.66, 0.33];

function riskTone(score: number) {
  if (score >= 70) return { dot: "fill-rose-500", ring: "text-rose-500", label: "text-rose-600 dark:text-rose-400" };
  if (score >= 45) return { dot: "fill-brand-500", ring: "text-brand-500", label: "text-brand-600 dark:text-brand-400" };
  return { dot: "fill-green-600", ring: "text-green-600", label: "text-green-700 dark:text-green-400" };
}

function polarPoint(index: number, total: number, score: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  // Yüksek risk merkeze yakın (radara "yaklaşan tehdit" gibi okunsun diye)
  const distanceRatio = 1 - (score / 100) * 0.72;
  const radius = MAX_RADIUS * Math.max(0.18, distanceRatio);
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

export function RiskRadarTab() {
  const { showError, showSuccess } = useToast();
  const [entries, setEntries] = useState<RiskEntry[]>([]);
  const [referred, setReferred] = useState<string[]>([]);
  const [referring, setReferring] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/risk-radar")
      .then((res) => res.json())
      .then((data) => setEntries((data.entries ?? []).slice(0, 12)))
      .catch(() => showError("Risk radarı yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refer(entry: RiskEntry) {
    setReferring(entry.id);
    try {
      const res = await fetch("/api/guidance-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: entry.id,
          authorName: "Yönetici",
          category: "ACADEMIC",
          confidentialityLevel: "RESTRICTED",
          note: "Risk radarı üzerinden yönetici tarafından sevk edildi.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sevk gönderilemedi.");
      setReferred((prev) => [...prev, entry.id]);
      showSuccess(`${entry.name} rehberliğe sevk edildi.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sevk gönderilemedi.");
    } finally {
      setReferring(null);
    }
  }

  const sorted = [...entries].sort((a, b) => b.riskScore - a.riskScore);

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-500" />
        <h2 className="text-sm font-semibold text-espresso dark:text-cream">Riskli Öğrenci & Rehberlik Sevk Radarı</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="mx-auto">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {RINGS.map((ratio) => (
              <circle
                key={ratio}
                cx={CENTER}
                cy={CENTER}
                r={MAX_RADIUS * ratio}
                fill="none"
                className="stroke-hairline dark:stroke-white/10"
                strokeWidth={1}
              />
            ))}
            <line x1={CENTER} y1={24} x2={CENTER} y2={SIZE - 24} className="stroke-hairline dark:stroke-white/10" strokeWidth={1} />
            <line x1={24} y1={CENTER} x2={SIZE - 24} y2={CENTER} className="stroke-hairline dark:stroke-white/10" strokeWidth={1} />

            {entries.map((entry, index) => {
              const point = polarPoint(index, entries.length, entry.riskScore);
              const tone = riskTone(entry.riskScore);
              return (
                <g key={entry.id}>
                  {entry.riskScore >= 70 && (
                    <motion.circle
                      cx={point.x}
                      cy={point.y}
                      r={6}
                      className={cn(tone.dot, "opacity-30")}
                      animate={{ r: [6, 14, 6], opacity: [0.35, 0, 0.35] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                  )}
                  <motion.circle
                    cx={point.x}
                    cy={point.y}
                    className={tone.dot}
                    initial={{ r: 0 }}
                    animate={{ r: 6 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: index * 0.06 }}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-2">
          {sorted.map((entry) => {
            const tone = riskTone(entry.riskScore);
            const isReferred = referred.includes(entry.id);
            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <div>
                  <p className="text-sm font-medium text-espresso dark:text-cream">{entry.name}</p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">{entry.branch}</p>
                  <span className="mt-1 inline-block rounded-full bg-white/70 px-2 py-0.5 text-[10px] text-espresso-muted dark:bg-white/10 dark:text-cream/50">
                    {RISK_REASON_LABEL[entry.reason]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm font-semibold", tone.label)}>{entry.riskScore}</span>
                  <button
                    onClick={() => refer(entry)}
                    disabled={isReferred || referring === entry.id}
                    title="Rehberliğe Sevk Et"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-espresso text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
                  >
                    {referring === entry.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isReferred ? (
                      <CheckCheck className="h-3.5 w-3.5" />
                    ) : (
                      <LifeBuoy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
          {entries.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Risk uyarısı yok.</p>}
        </div>
      </div>
    </motion.div>
  );
}
