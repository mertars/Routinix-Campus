"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Target, Users, Trophy, Globe2 } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type NetSummary = {
  targetNet: number | null;
  actualNet: number;
  trendBySubject: Record<string, { examLabel: string; net: number }[]>;
  branchRank: number;
  institutionRank: number;
  estimatedNationwidePercentile: number;
};

function NetTrendChart({ points }: { points: { examLabel: string; net: number }[] }) {
  const width = 300;
  const height = 90;
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => `${i * step},${height - ((p.net - min) / range) * (height - 16) - 8}`).join(" ");

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible text-brand-600">
        <motion.polyline
          points={coords}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        {points.map((p, i) => (
          <circle key={p.examLabel} cx={i * step} cy={height - ((p.net - min) / range) * (height - 16) - 8} r={3} fill="currentColor" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-espresso-muted dark:text-cream/30">
        {points.map((p) => (
          <span key={p.examLabel}>{p.examLabel.replace("Deneme-", "D")}</span>
        ))}
      </div>
    </div>
  );
}

export function NetTrackerTab() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [summary, setSummary] = useState<NetSummary | null>(null);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/students/${encodeURIComponent(studentId)}/net-summary`)
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch(() => showError("Net verisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  if (!summary) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>;
  }

  const delta = summary.actualNet - (summary.targetNet ?? summary.actualNet);

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Target className="h-4 w-4 text-brand-600" /> Hedef vs. Gerçekleşen Net
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-cream-card p-4 text-center dark:bg-white/5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Hedef Net</p>
            <p className="mt-1 text-2xl font-bold text-espresso dark:text-cream">{summary.targetNet ?? "—"}</p>
          </div>
          <div className="rounded-2xl bg-brand-600 p-4 text-center text-white">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">Gerçekleşen Net</p>
            <p className="mt-1 text-2xl font-bold">{summary.actualNet}</p>
          </div>
        </div>
        {summary.targetNet !== null && (
          <div className={cn("mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold", delta >= 0 ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300")}>
            {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            Hedefin {Math.abs(delta)} net {delta >= 0 ? "üzerinde" : "altında"}
          </div>
        )}
      </motion.div>

      {Object.entries(summary.trendBySubject).map(([subject, points]) => (
        <motion.div key={subject} whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">{subject} Net Trendi</h2>
          <NetTrendChart points={points} />
        </motion.div>
      ))}

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 text-center backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <Users className="mx-auto mb-1 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{summary.branchRank}.</p>
          <p className="text-[9px] text-espresso-muted dark:text-cream/40">Şube Sıralaması</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 text-center backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <Trophy className="mx-auto mb-1 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{summary.institutionRank}.</p>
          <p className="text-[9px] text-espresso-muted dark:text-cream/40">Kurum Sıralaması</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 text-center backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <Globe2 className="mx-auto mb-1 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">%{summary.estimatedNationwidePercentile}</p>
          <p className="text-[9px] text-espresso-muted dark:text-cream/40">Tahmini Türkiye Dilimi</p>
        </div>
      </motion.div>
      <p className="text-center text-[10px] text-espresso-muted/70 dark:text-cream/30">
        Türkiye geneli dilim, resmi bir ÖSYM/MEB verisi değil, temsili bir tahmindir.
      </p>
    </div>
  );
}
