"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Persona } from "@/lib/mock-data";

const TONE_STYLES = {
  espresso: "bg-espresso/8 text-espresso dark:bg-brand-600/15 dark:text-brand-500",
  amber: "bg-brand-50 text-brand-600 dark:bg-brand-600/15 dark:text-brand-500",
  green: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400",
} as const;

export function RoleCard({
  persona,
  icon: Icon,
  tone,
  index,
  onSelect,
}: {
  persona: Persona;
  icon: LucideIcon;
  tone: keyof typeof TONE_STYLES;
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-cream-card p-6 text-center shadow-sm transition-colors hover:border-brand-600/40 dark:border-white/10 dark:bg-midnight-card"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-full ${TONE_STYLES[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-espresso dark:text-cream">{persona.cardLabel}</p>
        <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">{persona.name}</p>
      </div>
    </motion.button>
  );
}
