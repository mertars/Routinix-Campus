"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  ClipboardList,
  Search,
  BarChart3,
  Layers,
  Target,
  LineChart,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { type OlcmeAnalytics, type AnalyticsTrendPoint, UNCATEGORIZED } from "./types";

type SortKey = "average" | "latest" | "rising" | "falling";

const SORT_LABELS: Record<SortKey, string> = {
  average: "Ortalamaya göre",
  latest: "Son denemeye göre",
  rising: "En çok yükselen",
  falling: "En çok düşen",
};

function deltaTone(delta: number | null) {
  if (delta === null || Math.abs(delta) < 0.5) return { icon: Minus, className: "text-espresso-muted dark:text-cream/40" };
  return delta > 0
    ? { icon: TrendingUp, className: "text-emerald-600 dark:text-emerald-400" }
    : { icon: TrendingDown, className: "text-rose-600 dark:text-rose-400" };
}

// Kurum geneli net trendi — grafik kütüphanesi YOK (bkz. package.json),
// projedeki diğer grafikler gibi elle SVG çiziliyor (aynı desen:
// components/xray/mastery-trend-charts.tsx). Alan dolgusu + çizgi +
// noktalar; y ekseni veriye göre otomatik ölçekleniyor.
function TrendChart({ points }: { points: AnalyticsTrendPoint[] }) {
  const W = 800;
  const H = 200;
  const PAD = { top: 16, right: 16, bottom: 28, left: 40 };

  const values = points.map((p) => p.averageNet);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || 1;
  const min = Math.max(0, rawMin - span * 0.15);
  const max = rawMax + span * 0.15;
  const range = max - min || 1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const coords = points.map((p, i) => ({
    x: PAD.left + (points.length > 1 ? i * step : innerW / 2),
    y: PAD.top + innerH - ((p.averageNet - min) / range) * innerH,
    point: p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${PAD.top + innerH} L${coords[0].x},${PAD.top + innerH} Z`;
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ y: PAD.top + innerH * t, value: Math.round((max - range * t) * 10) / 10 }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full">
      <defs>
        <linearGradient id="olcmeTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g) => (
        <g key={g.y}>
          <line x1={PAD.left} y1={g.y} x2={W - PAD.right} y2={g.y} stroke="currentColor" strokeWidth={1} className="text-espresso/10 dark:text-cream/10" />
          <text x={PAD.left - 8} y={g.y + 3} textAnchor="end" className="fill-current text-[9px] text-espresso-muted dark:text-cream/40">
            {g.value}
          </text>
        </g>
      ))}

      {points.length > 1 && <path d={areaPath} fill="url(#olcmeTrendFill)" />}
      {points.length > 1 && (
        <motion.path
          d={linePath}
          fill="none"
          stroke="#10B981"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}

      {coords.map((c) => (
        <g key={c.point.examId}>
          <circle cx={c.x} cy={c.y} r={4} fill="#10B981" />
          <circle cx={c.x} cy={c.y} r={7} fill="#10B981" opacity={0.18} />
          <title>{`${c.point.examName}: ${c.point.averageNet} net (${c.point.studentCount} öğrenci)`}</title>
        </g>
      ))}

      {coords.map((c, i) => (
        <text
          key={`${c.point.examId}-label`}
          x={c.x}
          y={H - 8}
          textAnchor={i === 0 ? "start" : i === coords.length - 1 ? "end" : "middle"}
          className="fill-current text-[9px] text-espresso-muted dark:text-cream/40"
        >
          {new Date(c.point.examDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
        </text>
      ))}
    </svg>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="text-[10px] text-espresso-muted/50 dark:text-cream/20">—</span>;
  const W = 52;
  const H = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = W / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${H - ((v - min) / range) * (H - 4) - 2}`).join(" ");
  const rising = values[values.length - 1] >= values[0];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={rising ? "#10B981" : "#F43F5E"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Deneme Analizi — Röntgen'in kurum panelinin deneme karşılığı (kullanıcı
// talebi: "röntgendeki gibi bir panel ama burada deneme sonuçlarını
// analiz edeceğiz"). Tek uçtan beslenir: /api/olcme/analytics.
export function OlcmeAnalyticsPanel() {
  const { showError } = useToast();
  const [category, setCategory] = useState<string | null>(null);
  const [data, setData] = useState<OlcmeAnalytics | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("average");

  useEffect(() => {
    setData(null);
    const qs = category === null ? "" : `?category=${encodeURIComponent(category)}`;
    fetch(`/api/olcme/analytics${qs}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => showError("Analiz yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const students = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const filtered = q ? data.students.filter((s) => `${s.firstName} ${s.lastName} ${s.branchName}`.toLocaleLowerCase("tr-TR").includes(q)) : data.students;
    const sorted = [...filtered];
    if (sortKey === "average") sorted.sort((a, b) => b.averageNet - a.averageNet);
    if (sortKey === "latest") sorted.sort((a, b) => b.latestNet - a.latestNet);
    if (sortKey === "rising") sorted.sort((a, b) => (b.delta ?? -Infinity) - (a.delta ?? -Infinity));
    if (sortKey === "falling") sorted.sort((a, b) => (a.delta ?? Infinity) - (b.delta ?? Infinity));
    return sorted;
  }, [data, query, sortKey]);

  if (!data) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const maxSubjectNet = Math.max(...data.subjectAverages.map((s) => s.averageNet), 1);
  const maxBranchNet = Math.max(...data.branches.map((b) => b.averageNet), 1);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-espresso dark:text-cream">
          <LineChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Deneme Analizi
        </h1>
        <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">
          Son {data.summary.examCount} denemenin kurum geneli gelişimi, ders ve şube karşılaştırması, öğrenci bazlı trendler.
        </p>
      </div>

      {/* Klasör filtresi */}
      {(data.categories.length > 0 || data.hasUncategorized) && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategory(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition",
              category === null
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            )}
          >
            Tümü
          </button>
          {data.categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition",
                category === c
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
              )}
            >
              {c}
            </button>
          ))}
          {data.hasUncategorized && (
            <button
              onClick={() => setCategory(UNCATEGORIZED)}
              className={cn(
                "rounded-full border border-dashed px-3 py-1.5 text-[11.5px] font-semibold transition",
                category === UNCATEGORIZED
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/15 dark:text-cream/50 dark:hover:bg-white/5"
              )}
            >
              Kategorisiz
            </button>
          )}
        </div>
      )}

      {data.summary.examCount === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-hairline bg-white/40 py-24 text-center dark:border-white/10 dark:bg-white/5">
          <Target className="h-6 w-6 text-espresso-muted dark:text-cream/30" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Analiz için yeterli veri yok</p>
          <p className="max-w-xs text-xs leading-relaxed text-espresso-muted dark:text-cream/40">
            Bu klasörde sonuçlanmış deneme bulunmuyor. Bir denemenin optik dosyasını yükledikten sonra burada gelişim grafiği oluşur.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Özet */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                <ClipboardList className="h-3 w-3" /> Deneme
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-espresso dark:text-cream">{data.summary.examCount}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                <Users className="h-3 w-3" /> Öğrenci
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-espresso dark:text-cream">{data.summary.studentCount}</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                <BarChart3 className="h-3 w-3" /> Kurum ortalaması
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums text-espresso dark:text-cream">
                {data.summary.averageNet}
                <span className="ml-1 text-[10.5px] font-medium text-espresso-muted dark:text-cream/40">net</span>
              </p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                <TrendingUp className="h-3 w-3" /> Son denemede
              </p>
              {data.summary.netChange === null ? (
                <p className="mt-1 text-xl font-bold text-espresso-muted dark:text-cream/40">—</p>
              ) : (
                <p
                  className={cn(
                    "mt-1 text-xl font-bold tabular-nums",
                    data.summary.netChange > 0 ? "text-emerald-600 dark:text-emerald-400" : data.summary.netChange < 0 ? "text-rose-600 dark:text-rose-400" : "text-espresso dark:text-cream"
                  )}
                >
                  {data.summary.netChange > 0 ? "+" : ""}
                  {data.summary.netChange}
                  <span className="ml-1 text-[10.5px] font-medium opacity-70">net</span>
                </p>
              )}
            </div>
          </div>

          {/* Trend grafiği */}
          <div className="rounded-2xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-xs font-semibold text-espresso dark:text-cream">Kurum Ortalama Net Gelişimi</p>
              {data.summary.latestExamName && (
                <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">Son: {data.summary.latestExamName}</p>
              )}
            </div>
            <TrendChart points={data.trend} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="min-w-0 space-y-4">
              {/* Ders ortalamaları */}
              <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                  <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Ders Ortalamaları
                  <span className="font-normal text-espresso-muted dark:text-cream/40">— zayıf ders üstte</span>
                </p>
                <div className="space-y-2.5">
                  {data.subjectAverages.map((s) => (
                    <div key={s.subject}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11.5px] font-medium text-espresso dark:text-cream">{s.subject}</span>
                        <span className="text-[11px] font-bold tabular-nums text-espresso dark:text-cream">{s.averageNet}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-emerald-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${(s.averageNet / maxSubjectNet) * 100}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Şube karşılaştırması */}
              {data.branches.length > 1 && (
                <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
                  <p className="mb-3 text-xs font-semibold text-espresso dark:text-cream">Şube Karşılaştırması</p>
                  <div className="space-y-2.5">
                    {data.branches.map((b, i) => (
                      <div key={b.branchName}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-espresso dark:text-cream">
                            <span className="text-[10px] text-espresso-muted dark:text-cream/40">{i + 1}.</span>
                            {b.branchName}
                            <span className="text-[10px] font-normal text-espresso-muted dark:text-cream/40">({b.studentCount} öğrenci)</span>
                          </span>
                          <span className="text-[11px] font-bold tabular-nums text-espresso dark:text-cream">{b.averageNet}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                          <motion.div
                            className={cn("h-full rounded-full", i === 0 ? "bg-emerald-500" : "bg-emerald-500/50")}
                            initial={{ width: 0 }}
                            animate={{ width: `${(b.averageNet / maxBranchNet) * 100}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* En zayıf kazanımlar */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                  <Target className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> En Zayıf Kazanımlar
                </p>
                <p className="mb-3 text-[10.5px] text-espresso-muted dark:text-cream/40">Son denemelerde en çok kaybedilen konular</p>
                {data.weakSubtopics.length === 0 ? (
                  <p className="py-6 text-center text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
                    Henüz kazanım eşlemesi yapılmamış. Bir denemenin &quot;Kazanım&quot; adımında soruları konulara bağlarsan burada dolar.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {data.weakSubtopics.map((w) => {
                      const tone = w.averagePercent < 30 ? "bg-rose-500" : w.averagePercent < 60 ? "bg-amber-500" : "bg-emerald-500";
                      const textTone =
                        w.averagePercent < 30
                          ? "text-rose-700 dark:text-rose-300"
                          : w.averagePercent < 60
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300";
                      return (
                        <div key={w.subtopicLabel}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[11px] font-medium text-espresso dark:text-cream">{w.subtopicLabel}</span>
                            <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", textTone)}>%{w.averagePercent}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                            <div className={cn("h-full rounded-full", tone)} style={{ width: `${w.averagePercent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Öğrenci tablosu */}
          <div className="rounded-2xl border border-hairline bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
            <div className="flex flex-wrap items-center gap-2 border-b border-hairline p-4 dark:border-white/10">
              <p className="mr-auto text-xs font-semibold text-espresso dark:text-cream">Öğrenci Gelişimi</p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Öğrenci ara..."
                  className="w-44 rounded-xl border border-hairline bg-white/70 py-2 pl-8 pr-3 text-[11px] text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
                />
              </div>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-xl border border-hairline bg-white/70 px-2.5 py-2 text-[11px] text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
              >
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <option key={k} value={k}>
                    {SORT_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[30rem] overflow-auto">
              <table className="w-full text-[11.5px]">
                <thead className="sticky top-0 z-10 bg-cream-card text-left text-[9.5px] uppercase tracking-wide text-espresso-muted dark:bg-midnight-card dark:text-cream/40">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Öğrenci</th>
                    <th className="px-3 py-2.5 font-semibold">Şube</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Deneme</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Son net</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Ortalama</th>
                    <th className="px-3 py-2.5 text-right font-semibold">En iyi</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Değişim</th>
                    <th className="px-4 py-2.5 font-semibold">Seyir</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const tone = deltaTone(s.delta);
                    const DeltaIcon = tone.icon;
                    return (
                      <tr key={s.studentId} className="border-t border-hairline transition hover:bg-emerald-500/[0.04] dark:border-white/10">
                        <td className="px-4 py-2.5 font-medium text-espresso dark:text-cream">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-espresso-muted dark:text-cream/50">{s.branchName}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-espresso-muted dark:text-cream/50">{s.examCount}</td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-espresso dark:text-cream">{s.latestNet}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-espresso-muted dark:text-cream/50">{s.averageNet}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-espresso-muted dark:text-cream/50">{s.bestNet}</td>
                        <td className={cn("px-3 py-2.5 text-right tabular-nums", tone.className)}>
                          <span className="flex items-center justify-end gap-1 font-semibold">
                            <DeltaIcon className="h-3 w-3" />
                            {s.delta === null ? "—" : `${s.delta > 0 ? "+" : ""}${s.delta}`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Sparkline values={s.history} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
