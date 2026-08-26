"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Hourglass } from "lucide-react";
import { spaceGrotesk } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

const EXAM_DATE = new Date("2027-06-20T09:00:00");

function useDaysRemaining(target: Date) {
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    const diff = target.getTime() - Date.now();
    setDays(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
  }, [target]);
  return days;
}

export function Hero({ name, title }: { name: string; title: string }) {
  const daysRemaining = useDaysRemaining(EXAM_DATE);
  const [campMode, setCampMode] = useState(false);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 hidden h-px dark:block dark:bg-gradient-to-r dark:from-transparent dark:via-brand-500/70 dark:to-transparent" />
      <AnimatePresence>
        {campMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-30"
          >
            <motion.div
              className="absolute inset-0"
              style={{
                background: "radial-gradient(circle at 50% 0%, rgb(var(--brand-600) / 0.28), transparent 60%)",
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col gap-6 px-4 pb-6 pt-8 sm:px-6 md:flex-row md:items-center md:justify-between md:pl-32 md:pr-32">
        <div>
          <motion.p
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-espresso/50 dark:text-cream/40"
          >
            Kurum Müdürü Paneli
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className={cn(spaceGrotesk.className, "mt-2 text-5xl font-bold tracking-tight text-espresso dark:text-cream sm:text-6xl md:text-7xl")}
          >
            {name}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-1 text-lg font-medium text-brand-600"
          >
            {title}
          </motion.p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center gap-2 rounded-2xl border border-hairline bg-white/70 px-5 py-3 backdrop-blur-sm transition-colors dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-xl dark:hover:border-brand-500/40"
          >
            <motion.span
              animate={{ rotate: [0, 180, 180, 0, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.15, 0.5, 0.65, 1] }}
              className="inline-flex"
            >
              <Hourglass className="h-4 w-4 text-brand-600" />
            </motion.span>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-espresso/50 dark:text-cream/40">
                YKS 2027 Geri Sayımı
              </p>
              <p className="text-lg font-bold leading-tight text-espresso dark:text-cream">
                {daysRemaining != null ? `${daysRemaining} gün` : "—"}
              </p>
            </div>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCampMode((value) => !value)}
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-medium transition-colors",
              campMode
                ? "border-brand-500/50 bg-brand-600 text-white shadow-[0_0_30px_-6px_rgb(var(--brand-600)/0.7)]"
                : "border-hairline bg-white/70 text-espresso backdrop-blur-sm hover:border-brand-600/40 dark:border-brand-500/20 dark:bg-midnight-card/50 dark:text-cream dark:backdrop-blur-xl dark:hover:border-brand-500/40"
            )}
          >
            <Flame className={cn("h-4 w-4", campMode && "animate-pulse")} />
            {campMode ? "KAMP MODU AKTİF" : "Seri Deneme / Kamp Modu"}
            <span className="relative ml-1 flex h-4 w-7 items-center rounded-full bg-black/10 p-0.5 dark:bg-white/20">
              <motion.span
                className="h-3 w-3 rounded-full bg-white shadow-sm"
                animate={{ x: campMode ? 12 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 28 }}
              />
            </span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
