"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { NavTab } from "./floating-nav";
import { useAgenda } from "@/lib/agenda-store";
import type { NavBadge } from "@/lib/agenda-badges";
import type { AgendaItem, AgendaUrgency } from "@/lib/agenda-types";

type Side = "left" | "right";

// Ada iki ende de AYNI ikon konumunu korur: kapalıyken genişlik tam
// olarak dolgu + düğme kadardır (2 × 10px + 44px), açılınca yalnızca
// yazı için yer eklenir. Yani ikonlar yerinden oynamaz, sadece adları
// okunur olur — kas hafızası bozulmaz.
const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 284;

// Renkler Gündem panelindeki nokta renkleriyle AYNI olmalı: aynı
// aciliyetin iki yerde iki farklı rengi olması okuyanı yanıltır.
const BADGE_TONE: Record<AgendaUrgency, string> = {
  critical: "bg-red-500 text-white",
  attention: "bg-amber-500 text-espresso",
  info: "bg-sky-500 text-white",
};

// ROZET SEBEP PANELİ — "1 bildirim gözüküyor ama sebep ne?"
//
// ⚠️ NEDEN VAR (Mert, 2026-09-18): "çakışmasız ders programında 1 bildirim
// gözüküyor ama sebep ne? Her menüde o bildirimlerin sebebinin olduğu küçük
// bir panel olsun." Rozet sayıyı söylüyordu ama gerekçeyi söylemiyordu;
// kullanıcı sekmeye girip eksiği kendisi aramak zorunda kalıyordu. Oysa
// gerekçe ZATEN elimizde: rozet Gündem maddelerinden türetiliyor ve her
// maddenin başlığı/detayı var (bkz. lib/agenda-types.ts > AgendaItem).
//
// ⚠️ PORTAL ZORUNLU, İKİ SEBEPTEN: (1) ada `overflow-hidden` — içine
// konan panel kırpılırdı; (2) ada bir `motion.nav`, yani `transform`lu bir
// ata — transform'lu ata, içindeki `position: fixed` için yeni kapsayıcı
// blok yaratır ve panel ekranın yanlış yerine çapalanırdı (bu tuzağa bu
// kod tabanında renk paletinde ve ayarlar sayfasında düşülmüştü).
function BadgeReasons({
  anchor,
  items,
  side,
}: {
  anchor: DOMRect;
  items: AgendaItem[];
  side: Side;
}) {
  const WIDTH = 268;
  const top = Math.max(12, Math.min(anchor.top - 8, window.innerHeight - 220));
  // ⚠️ Konum ÖLÇÜLMEZ, HESAPLANIR — ve bu bir düzeltme (ekran
  // görüntüsüyle iki kez görüldü): ada fareyle 64px'ten 284px'e genişliyor,
  // ama ölçüm hover'ın BAŞINDA alındığı için hep daralmış hâli okunuyor ve
  // panel genişleyen adanın altında kalıyordu. Ada `left-6`/`right-6` ile
  // sabit konumlu ve genişliği sabit (EXPANDED_WIDTH), yani dış kenarı
  // kesin olarak bilinebilir.
  const EDGE = 24; // left-6 / right-6
  const left =
    side === "left" ? EDGE + EXPANDED_WIDTH + 12 : window.innerWidth - EDGE - EXPANDED_WIDTH - WIDTH - 12;
  return createPortal(
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -6 : 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      style={{ top, left, width: WIDTH }}
      className="pointer-events-none fixed z-[70] rounded-2xl border border-white/10 bg-midnight-card/95 p-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] backdrop-blur-2xl"
    >
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-cream/40">Neden bildirim var</p>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.key} className="flex gap-2">
            <span
              className={cn(
                "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                item.urgency === "critical" ? "bg-red-500" : item.urgency === "attention" ? "bg-amber-500" : "bg-sky-500"
              )}
            />
            <span className="min-w-0">
              <span className="block text-[12px] font-medium leading-snug text-cream">{item.title}</span>
              <span className="block text-[10.5px] leading-snug text-cream/50">{item.detail}</span>
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-white/10 pt-1.5 text-[10px] text-cream/35">Tıklayınca bu sekme açılır.</p>
    </motion.div>,
    document.body
  );
}

function IslandButton({
  tab,
  isActive,
  onSelect,
  side,
  expanded,
  badge,
  reasons,
}: {
  tab: NavTab;
  isActive: boolean;
  onSelect: (id: string) => void;
  side: Side;
  expanded: boolean;
  badge?: NavBadge;
  /** Bu sekmedeki rozeti doğuran Gündem maddeleri. */
  reasons: AgendaItem[];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const showReasons = rect !== null && reasons.length > 0;
  const measure = () => setRect(ref.current?.getBoundingClientRect() ?? null);

  return (
    <button
      ref={ref}
      onMouseEnter={measure}
      onMouseLeave={() => setRect(null)}
      onFocus={measure}
      onBlur={() => setRect(null)}
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

      <AnimatePresence>
        {showReasons && <BadgeReasons anchor={rect} items={reasons} side={side} />}
      </AnimatePresence>
    </button>
  );
}

function Island({
  tabs,
  activeTab,
  onSelect,
  side,
  badges,
  itemsByTab,
}: {
  tabs: readonly NavTab[];
  activeTab: string;
  onSelect: (id: string) => void;
  side: Side;
  badges: Record<string, NavBadge>;
  itemsByTab: Record<string, AgendaItem[]>;
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
            reasons={itemsByTab[tab.id] ?? []}
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
  showWork = true,
}: {
  leftTabs: readonly NavTab[];
  rightTabs: readonly NavTab[];
  activeTab: string;
  onSelect: (id: string) => void;
  /**
   * Rozetler yalnızca yönetimde anlamlı — /api/admin/agenda o role kilitli.
   * Öğretmen/öğrenci sayfaları bu adayı ödünç aldığında false geçmeli,
   * yoksa her açılışta 403 dönen boşuna bir istek atılır.
   */
  showWork?: boolean;
}) {
  const { badges, items } = useAgenda(showWork);

  // Rozetin gerekçesi: aynı sekmeye düşen Gündem maddeleri. Rozet sayısı
  // zaten bunların toplamı (bkz. lib/agenda-badges.ts > toBadges).
  const itemsByTab: Record<string, AgendaItem[]> = {};
  for (const item of items ?? []) {
    if (!item.tab || item.count <= 0) continue;
    (itemsByTab[item.tab] ??= []).push(item);
  }

  return (
    <>
      <Island tabs={leftTabs} activeTab={activeTab} onSelect={onSelect} side="left" badges={badges} itemsByTab={itemsByTab} />
      <Island tabs={rightTabs} activeTab={activeTab} onSelect={onSelect} side="right" badges={badges} itemsByTab={itemsByTab} />
    </>
  );
}
