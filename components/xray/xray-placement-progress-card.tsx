"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Snapshot = { avg: number; assessedAt: string };
type ProgressResponse = { hasPlacement: false } | { hasPlacement: true; before: Snapshot; after: Snapshot };

function scoreTone(score: number): string {
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

// Faz Q — "Öncesi/Sonrası — Satış Anı Kartı" mockup'ının (Röntgen Filmi
// artifact, Panel C) gerçek veriyle çalışan hali. Bir öğrencinin Seviye
// Belirleme Sınavı'nı (variant="yerlestirme") tamamladığı andaki ortalama
// ile GÜNCEL ortalamasını yan yana gösterir — hiç yerlestirme sınavı
// tamamlanmadıysa (hasPlacement=false) HİÇBİR ŞEY render etmez (henüz
// atanmamış/tamamlanmamış öğrencilerde panel kalabalıklaşmasın diye).
export function XrayPlacementProgressCard({ studentId, subject }: { studentId: string; subject: string }) {
  const [data, setData] = useState<ProgressResponse | null>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/xray/placement-progress/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((json) => setData(json))
      .catch(() => setData({ hasPlacement: false }));
  }, [studentId, subject]);

  if (!data || !data.hasPlacement) return null;

  const delta = data.after.avg - data.before.avg;
  const isUp = delta > 0;
  const isDown = delta < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-espresso dark:text-cream">Seviye Belirlemeden Bugüne</h2>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            isUp && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
            isDown && "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
            !isUp && !isDown && "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/50"
          )}
        >
          {isUp && <TrendingUp className="h-3 w-3" />}
          {isDown && <TrendingDown className="h-3 w-3" />}
          {isUp ? "+" : ""}
          {delta} puan
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="rounded-2xl bg-cream-card p-4 text-center dark:bg-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Başlangıç</p>
          <p className="mt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(data.before.assessedAt).toLocaleDateString("tr-TR")}</p>
          <p className={cn("mt-2 text-3xl font-bold", scoreTone(data.before.avg))}>%{data.before.avg}</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-espresso-muted dark:text-cream/30" />
        <div className="rounded-2xl bg-cream-card p-4 text-center dark:bg-white/5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Bugün</p>
          <p className="mt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(data.after.assessedAt).toLocaleDateString("tr-TR")}</p>
          <p className={cn("mt-2 text-3xl font-bold", scoreTone(data.after.avg))}>%{data.after.avg}</p>
        </div>
      </div>
    </motion.div>
  );
}
