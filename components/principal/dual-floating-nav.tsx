"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { NavTab } from "./floating-nav";

type Side = "left" | "right";

function IslandButton({
  tab,
  isActive,
  onSelect,
  side,
}: {
  tab: NavTab;
  isActive: boolean;
  onSelect: (id: string) => void;
  side: Side;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={() => onSelect(tab.id)}
        aria-label={tab.label}
        className={cn(
          "group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-colors duration-200",
          isActive && "bg-brand-500/10"
        )}
      >
        {isActive && (
          <motion.span
            layoutId="activeIndicator"
            className="absolute left-0.5 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-brand-500 shadow-[0_0_10px_rgb(var(--brand-500)/0.75)]"
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
        )}
        <tab.icon
          className={cn("relative z-10 h-5 w-5 transition-colors", isActive ? "text-brand-400" : "text-cream/50 group-hover:text-cream")}
        />
      </button>

      <AnimatePresence>
        {hovered && (
          <motion.span
            initial={{ opacity: 0, x: side === "left" ? -8 : 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: side === "left" ? -8 : 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn(
              "pointer-events-none absolute top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-lg border border-white/20 bg-white/70 px-2.5 py-1.5 text-xs font-medium text-espresso shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream",
              side === "left" ? "left-full ml-3" : "right-full mr-3"
            )}
          >
            {tab.label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Island({
  tabs,
  activeTab,
  onSelect,
  side,
}: {
  tabs: readonly NavTab[];
  activeTab: string;
  onSelect: (id: string) => void;
  side: Side;
}) {
  return (
    // Dikey ortalama ('-translate-y-1/2') animasyonsuz dış sarmalayıcıda —
    // Framer Motion'ın kendi 'x' animasyonuyla aynı elemanda birleşirse
    // Tailwind'in Y ofsetini eziyor (bkz. modal.tsx'teki aynı düzeltme).
    <div className={cn("fixed top-1/2 z-50 hidden -translate-y-1/2 md:block", side === "left" ? "left-6" : "right-6")}>
      <motion.nav
        initial={{ opacity: 0, x: side === "left" ? -16 : 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col space-y-2 rounded-3xl border border-white/10 bg-midnight-card/50 p-2.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-2xl"
      >
        {tabs.map((tab) => (
          <IslandButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onSelect={onSelect} side={side} />
        ))}
      </motion.nav>
    </div>
  );
}

export function DualFloatingNav({
  leftTabs,
  rightTabs,
  activeTab,
  onSelect,
}: {
  leftTabs: readonly NavTab[];
  rightTabs: readonly NavTab[];
  activeTab: string;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <Island tabs={leftTabs} activeTab={activeTab} onSelect={onSelect} side="left" />
      <Island tabs={rightTabs} activeTab={activeTab} onSelect={onSelect} side="right" />
    </>
  );
}
