"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

export type OverallTrendPoint = { assessedAt: string; average: number; subtopicId: string; subtopicName: string; masteryScore: number };
export type SubtopicSeries = { subtopicId: string; subtopicName: string; points: { assessedAt: string; masteryScore: number }[] };
export type PeriodComparisonRow = { subtopicId: string; subtopicName: string; previousScore: number | null; currentScore: number; delta: number | null };
export type Heatmap = { months: string[]; rows: { subtopicId: string; subtopicName: string; valuesByMonth: (number | null)[] }[] };
export type MasteryHistoryResponse = {
  subject: string;
  overallTrend: OverallTrendPoint[];
  perSubtopic: SubtopicSeries[];
  periodComparison: PeriodComparisonRow[];
  heatmap: Heatmap;
};

const LINE_COLORS = ["#0284C7", "#F59E0B", "#10B981", "#F43F5E", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

function scoreColor(score: number): string {
  if (score >= 60) return "#10B981";
  if (score >= 30) return "#F59E0B";
  return "#F43F5E";
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
}

// Ana analiz kartına gömülü, öne çıkan/"featured" grafik — genel ortalama
// trendinin küçük bir sparkline'ı. Tıklanınca detaylı grafiklere açılır
// (bkz. MasteryTrendDrilldown) — kullanıcının "öne çıkan bir tanesini
// sayfaya koy, tıklayınca detaylı grafiklere giriş yapılsın" isteği.
// Kullanıcı geri bildirimi — sağ sütunun sabit alt bölümünde (bkz.
// xray-results-panel.tsx) bu kart eski küçük boyutuyla altındaki boş
// alanı doldurmuyor, "sıkışık" görünüyordu — `size="lg"` o kullanım için,
// öğretmen tarafındaki orta sütun kullanımı (varsayılan "sm") DEĞİŞMEDİ.
export function MasterySparkline({ points, onClick, size = "sm" }: { points: OverallTrendPoint[]; onClick?: () => void; size?: "sm" | "lg" }) {
  const large = size === "lg";
  const width = large ? 220 : 160;
  const height = large ? 64 : 44;
  const values = points.map((p) => p.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => `${i * step},${height - ((p.average - min) / range) * (height - 10) - 5}`).join(" ");
  const first = points[0].average;
  const last = points[points.length - 1].average;
  const delta = last - first;
  // Veli görünümü gibi salt-görüntüleme bağlamlarında onClick verilmez —
  // o zaman tıklanamaz bir <button> yerine anlamsal olarak doğru <div>
  // render edilir (bkz. parent/xray-summary-card.tsx'teki yeniden kullanım).
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white/70 text-left shadow-sm backdrop-blur-sm transition hover:border-sky-400/40 dark:border-white/10 dark:bg-midnight-card/50",
        large ? "p-5" : "p-3.5"
      )}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0 overflow-visible text-sky-600 dark:text-sky-400">
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
      <div className="min-w-0">
        <p className={cn("font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40", large ? "text-[11px]" : "text-[10px]")}>
          Genel Gelişim Trendi
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={cn("font-bold text-espresso dark:text-cream", large ? "text-2xl" : "text-lg")}>%{last}</span>
          {Math.abs(delta) < 1 ? (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-espresso-muted dark:text-cream/40">
              <Minus className="h-3 w-3" /> değişim yok
            </span>
          ) : (
            <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold", delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
        </div>
        {onClick && <p className="text-[10px] text-espresso-muted dark:text-cream/40">Detaylı grafikler için dokun</p>}
      </div>
    </Wrapper>
  );
}

function MultiLineChart({ series }: { series: SubtopicSeries[] }) {
  const width = 600;
  const height = 180;
  const padding = 8;

  const allPoints = series.flatMap((s) => s.points.map((p) => new Date(p.assessedAt).getTime()));
  const minTime = Math.min(...allPoints);
  const maxTime = Math.max(...allPoints);
  const timeRange = maxTime - minTime || 1;

  const xFor = (iso: string) => ((new Date(iso).getTime() - minTime) / timeRange) * (width - padding * 2) + padding;
  const yFor = (score: number) => height - (score / 100) * (height - padding * 2) - padding;

  return (
    <div className="overflow-x-auto">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-[500px] overflow-visible">
        {[0, 25, 50, 75, 100].map((tick) => (
          <line key={tick} x1={padding} x2={width - padding} y1={yFor(tick)} y2={yFor(tick)} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
        ))}
        {series.map((s, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const points = s.points.map((p) => `${xFor(p.assessedAt)},${yFor(p.masteryScore)}`).join(" ");
          return (
            <g key={s.subtopicId}>
              <motion.polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.1, ease: "easeOut", delay: i * 0.05 }}
              />
              {s.points.map((p, pi) => (
                <circle key={pi} cx={xFor(p.assessedAt)} cy={yFor(p.masteryScore)} r={2.5} fill={color} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
        {series.map((s, i) => (
          <span key={s.subtopicId} className="flex items-center gap-1.5 text-[10px] font-medium text-espresso-muted dark:text-cream/50">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
            {s.subtopicName}
          </span>
        ))}
      </div>
    </div>
  );
}

function PeriodComparisonBars({ rows }: { rows: PeriodComparisonRow[] }) {
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.subtopicId}>
          <div className="mb-1 flex items-center justify-between text-[11px]">
            <span className="min-w-0 truncate text-espresso-muted dark:text-cream/50">{r.subtopicName}</span>
            {r.delta !== null && (
              <span
                className={cn(
                  "flex shrink-0 items-center gap-0.5 font-semibold",
                  r.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : r.delta < 0 ? "text-rose-600 dark:text-rose-400" : "text-espresso-muted dark:text-cream/40"
                )}
              >
                {r.delta > 0 ? <TrendingUp className="h-3 w-3" /> : r.delta < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                {r.delta > 0 ? "+" : ""}
                {r.delta} (30 gün)
              </span>
            )}
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
            {r.previousScore !== null && (
              <div className="absolute top-0 h-full w-0.5 bg-espresso/40 dark:bg-cream/40" style={{ left: `${r.previousScore}%` }} />
            )}
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: scoreColor(r.currentScore) }}
              initial={{ width: 0 }}
              animate={{ width: `${r.currentScore}%` }}
              transition={{ type: "spring", stiffness: 70, damping: 15 }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">Dikey çizgi: 30 gün önceki skor · Renkli çubuk: güncel skor</p>
    </div>
  );
}

function MasteryHeatmap({ heatmap }: { heatmap: Heatmap }) {
  if (heatmap.months.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-32" />
            {heatmap.months.map((m) => (
              <th key={m} className="pb-1 text-[9px] font-semibold text-espresso-muted dark:text-cream/40">
                {monthLabel(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.rows.map((row) => (
            <tr key={row.subtopicId}>
              <td className="max-w-[128px] truncate pr-2 text-[10px] font-medium text-espresso dark:text-cream">{row.subtopicName}</td>
              {row.valuesByMonth.map((value, i) =>
                value === null ? (
                  <td key={i}>
                    <div title="Veri yok" className="h-7 w-full rounded-md bg-cream-muted dark:bg-white/10" />
                  </td>
                ) : (
                  <td key={i}>
                    <div
                      title={`%${value}`}
                      className="flex h-7 w-full items-center justify-center rounded-md text-[9px] font-semibold text-white"
                      style={{ backgroundColor: scoreColor(value), opacity: 0.55 + (value / 100) * 0.45 }}
                    >
                      {value}
                    </div>
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MasteryTrendDrilldown({ isOpen, onClose, data }: { isOpen: boolean; onClose: () => void; data: MasteryHistoryResponse | null }) {
  const hasData = !!data && data.overallTrend.length > 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${data?.subject ?? ""} — Gelişim Grafikleri`} variant="center" widthClassName="max-w-2xl">
      {!hasData ? (
        <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz yeterli veri yok — birden fazla değerlendirme sonrası grafikler burada görünecek.</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Konu Bazlı Trend</h4>
            <MultiLineChart series={data!.perSubtopic} />
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Son 30 Gün Karşılaştırma</h4>
            <PeriodComparisonBars rows={data!.periodComparison} />
          </section>
          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Aylık Isı Haritası</h4>
            <MasteryHeatmap heatmap={data!.heatmap} />
          </section>
        </div>
      )}
    </Modal>
  );
}
