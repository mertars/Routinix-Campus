"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { NavTab } from "./floating-nav";
import { useToday, type NavBadge, type TaskUrgency } from "@/lib/today-context";

type Side = "left" | "right";

// Ada iki ende de AYNI ikon konumunu korur: kapalıyken genişlik tam
// olarak dolgu + düğme kadardır (2 × 10px + 44px), açılınca yalnızca
// yazı için yer eklenir. Yani ikonlar yerinden oynamaz, sadece adları
// okunur olur — kas hafızası bozulmaz.
const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 284;

const BADGE_TONE: Record<TaskUrgency, string> = {
  critical: "bg-red-500 text-white",
  attention: "bg-amber-500 text-espresso",
  info: "bg-brand-500 text-white",
};

function IslandButton({
  tab,
  isActive,
  onSelect,
  side,
  expanded,
  badge,
}: {
  tab: NavTab;
  isActive: boolean;
  onSelect: (id: string) => void;
  side: Side;
  expanded: boolean;
  badge?: NavBadge;
}) {
  return (
    <button
      onClick={() => onSelect(tab.id)}
      aria-label={badge ? `${tab.label} — ${badge.count} bekleyen iş` : tab.label}
      className={cn(
        "group relative flex h-11 w-full items-center rounded-2xl transition-colors duration-200",
        side === "right" && "flex-row-reverse",
        isActive && "bg-brand-500/10"
      )}
    >
      {isActive && (
        <motion.span
          layoutId="activeIndicator"
          className={cn(
            "absolute top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-brand-500 shadow-[0_0_10px_rgb(var(--brand-500)/0.75)]",
            side === "left" ? "left-0.5" : "right-0.5"
          )}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}

      {/* İkon kutusu sabit 44px — adanın açılıp kapanmasından etkilenmez. */}
      <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center">
        <tab.icon
          className={cn("h-5 w-5 transition-colors", isActive ? "text-brand-400" : "text-cream/50 group-hover:text-cream")}
        />
        {badge && (
          <span
            className={cn(
              "absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none tabular-nums shadow-sm ring-2 ring-midnight-card/80",
              BADGE_TONE[badge.urgency]
            )}
          >
            {badge.count > 9 ? "9+" : badge.count}
          </span>
        )}
      </span>

      {/* Yazı ada kapalıyken de DOM'da durur; ada 'overflow-hidden'
          olduğu için kırpılır. Böylece açılma tek bir genişlik
          animasyonudur, içerik yeniden yerleşmez. */}
      <span
        className={cn(
          "relative z-10 min-w-0 flex-1 truncate text-[13px] transition-opacity duration-150",
          side === "left" ? "pr-2 text-left" : "pl-2 text-right",
          isActive ? "font-medium text-cream" : "text-cream/80 group-hover:text-cream",
          expanded ? "opacity-100" : "opacity-0"
        )}
      >
        {tab.label}
      </span>
    </button>
  );
}

function Island({
  tabs,
  activeTab,
  onSelect,
  side,
  badges,
}: {
  tabs: readonly NavTab[];
  activeTab: string;
  onSelect: (id: string) => void;
  side: Side;
  badges: Record<string, NavBadge>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    // Dikey ortalama ('-translate-y-1/2') animasyonsuz dış sarmalayıcıda —
    // Framer Motion'ın kendi 'x' animasyonuyla aynı elemanda birleşirse
    // Tailwind'in Y ofsetini eziyor (bkz. modal.tsx'teki aynı düzeltme).
    <div className={cn("fixed top-1/2 z-[55] hidden -translate-y-1/2 md:block", side === "left" ? "left-6" : "right-6")}>
      <motion.nav
        initial={{ opacity: 0, x: side === "left" ? -16 : 16, width: COLLAPSED_WIDTH }}
        animate={{ opacity: 1, x: 0, width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={{ duration: 0.5, ease: "easeOut", width: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        // Klavyeyle gezenler de etiketleri görsün.
        onFocusCapture={() => setExpanded(true)}
        onBlurCapture={() => setExpanded(false)}
        className="flex flex-col space-y-2 overflow-hidden rounded-3xl border border-white/10 bg-midnight-card/50 p-2.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] backdrop-blur-2xl"
      >
        {tabs.map((tab) => (
          <IslandButton
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTab}
            onSelect={onSelect}
            side={side}
            expanded={expanded}
            badge={badges[tab.id]}
          />
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
  const { badges } = useToday();

  return (
    <>
      <Island tabs={leftTabs} activeTab={activeTab} onSelect={onSelect} side="left" badges={badges} />
      <Island tabs={rightTabs} activeTab={activeTab} onSelect={onSelect} side="right" badges={badges} />
    </>
  );
}
