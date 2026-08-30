"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";

type SubjectTrend = { subject: string; current: number; delta: number | null; sparkline: { assessedAt: string; average: number }[]; lastAssessedAt: string };

function message(subject: string, delta: number | null): string {
  if (delta === null) return `${subject} dersinde gelişimini takip etmeye başladık — birkaç değerlendirme sonra burada trendini göreceksin.`;
  if (delta >= 10) return `${subject} dersinde son 30 günde %${delta} arttın — harika gidiyorsun!`;
  if (delta > 0) return `${subject} dersinde geçen aya göre %${delta} arttın.`;
  if (delta === 0) return `${subject} dersinde son 30 günde değişim yok — bir sonraki teste hazır ol.`;
  return `${subject} dersinde bu ay biraz durakladın — tekrar pratik yapmaya ne dersin?`;
}

// Faz M — öğrencinin KENDİ geçmişiyle karşılaştırması, akran kıyaslaması
// YOK (bilinçli, hassas bir alan). Sadece en son aktif dersteki genel
// ortalama trendi öne çıkarır — /xray/principal'daki MasterySparkline'ın
// tam tersi bir ton (tıklanabilir/analitik değil, sabit/motivasyonel).
export function XraySelfProgressCard() {
  const [subjects, setSubjects] = useState<SubjectTrend[] | null>(null);

  useEffect(() => {
    fetch("/api/xray/my-mastery-trend")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setSubjects(data.subjects ?? []))
      .catch(() => setSubjects([]));
  }, []);

  if (!subjects || subjects.length === 0) return null;
  const featured = subjects[0];
  const isPositive = featured.delta !== null && featured.delta > 0;
  const isNegative = featured.delta !== null && featured.delta < 0;

  const width = 260;
  const height = 50;
  const values = featured.sparkline.map((p) => p.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (featured.sparkline.length - 1 || 1);
  const coords = featured.sparkline.map((p, i) => `${i * step},${height - ((p.average - min) / range) * (height - 12) - 6}`).join(" ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-brand-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-brand-500/15 dark:bg-midnight-card/50"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Sparkles className="h-4 w-4 text-brand-600" /> Gelişimin
        </h2>
        <span className="text-lg font-bold text-espresso dark:text-cream">%{featured.current}</span>
      </div>

      {featured.sparkline.length >= 2 && (
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="mb-2 overflow-visible text-brand-600">
          <motion.polyline
            points={coords}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
      )}

      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-espresso-muted dark:text-cream/50">
        {isPositive && <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
        {isNegative && <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />}
        <span>{message(featured.subject, featured.delta)}</span>
      </p>
    </motion.div>
  );
}
