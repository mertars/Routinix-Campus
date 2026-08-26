"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Persona } from "@/lib/mock-data";

export function RoleCard({
  persona,
  icon: Icon,
  description,
  index,
  onSelect,
}: {
  persona: Persona;
  icon: LucideIcon;
  description: string;
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className="group relative flex min-h-[196px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-xl backdrop-blur-xl transition-colors duration-300 hover:border-[#FF8C00]/40"
    >
      <div
        className="pointer-events-none absolute -inset-1 rounded-[1.5rem] bg-gradient-to-br from-[#FF6B00]/0 to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:from-[#FF6B00]/40 group-hover:opacity-100"
        aria-hidden
      />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-[#FF8C00]/20 bg-[#FF8C00]/10 text-[#FFA347] transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-6 w-6" />
      </div>
      <div className="relative">
        <p className="text-sm font-semibold text-white">{persona.cardLabel}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/40">{description}</p>
      </div>
    </motion.button>
  );
}
