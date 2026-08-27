"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { MagneticCard } from "./magnetic-card";
import { cn } from "@/lib/utils";

const TONE_STYLES = {
  default: "bg-espresso/8 text-espresso dark:bg-brand-600/15 dark:text-brand-500",
  success: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  warning: "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-500",
} as const;

type Trend = {
  points: number[];
  changePercent: number;
  goodDirection?: "up" | "down";
};

function Sparkline({ points }: { points: number[] }) {
  const width = 44;
  const height = 16;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((value, index) => `${index * step},${height - ((value - min) / range) * height}`).join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible text-brand-600">
      <motion.polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
      />
    </svg>
  );
}

function TrendBadge({ changePercent, goodDirection = "up" }: { changePercent: number; goodDirection?: "up" | "down" }) {
  const effectiveSign = goodDirection === "down" ? -changePercent : changePercent;
  const tone =
    effectiveSign > 0
      ? "text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-500/15"
      : effectiveSign < 0
        ? "text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-500/15"
        : "text-espresso-muted bg-cream-card dark:text-cream/40 dark:bg-white/5";
  const label = changePercent === 0 ? "±%0" : `${changePercent > 0 ? "+" : "-"}%${Math.abs(changePercent)}`;

  return <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", tone)}>{label}</span>;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  pulse = false,
  progress,
  trend,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: keyof typeof TONE_STYLES;
  pulse?: boolean;
  progress?: number;
  trend?: Trend;
  onClick?: () => void;
}) {
  return (
    <MagneticCard
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-hairline bg-white/80 p-4 text-left shadow-sm backdrop-blur-sm transition-all duration-300 dark:border-white/10 dark:bg-midnight-card/50 dark:backdrop-blur-sm dark:hover:border-brand-500/40 dark:hover:shadow-[0_0_30px_-8px_rgb(var(--brand-600)/0.5)]"
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${TONE_STYLES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-green-400"
              animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600" />
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-espresso dark:text-cream">{value}</p>
      <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/50">{label}</p>
      {progress != null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-espresso dark:bg-gradient-to-r dark:from-brand-600 dark:to-brand-400 dark:shadow-[0_0_8px_rgb(var(--brand-500)/0.6)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 16, delay: 0.2 }}
          />
        </div>
      )}
      {trend && (
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <TrendBadge changePercent={trend.changePercent} goodDirection={trend.goodDirection} />
          <Sparkline points={trend.points} />
        </div>
      )}
    </MagneticCard>
  );
}
