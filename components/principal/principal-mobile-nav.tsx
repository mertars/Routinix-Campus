"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, GraduationCap, ClipboardList, Grid3x3, X, Search } from "lucide-react";
import type { NavTab } from "@/components/principal/floating-nav";
import { cn } from "@/lib/utils";

const AKADEMIK_IDS = ["students", "upload", "exam-seating", "live-tutoring"];
const IDARI_IDS = ["attendance", "schedule-matrix", "campus", "risk"];

function BottomSheetShell({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-espresso/40 backdrop-blur-sm md:hidden"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 500) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[80vh] flex-col rounded-t-3xl border-t border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex shrink-0 justify-center pt-2.5">
              <span className="h-1.5 w-10 rounded-full bg-hairline dark:bg-white/20" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ModuleGridButton({ tab, isActive, onClick }: { tab: NavTab; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-[64px] flex-col items-start justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-left transition",
        isActive
          ? "border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300"
          : "border-hairline bg-cream-card text-espresso dark:border-white/10 dark:bg-white/5 dark:text-cream"
      )}
    >
      <tab.icon className={cn("h-4 w-4", isActive ? "text-brand-600 dark:text-brand-400" : "text-brand-600")} />
      <span className="text-xs font-medium leading-tight">{tab.label}</span>
    </button>
  );
}

export function PrincipalMobileNav({
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
  const allTabs = useMemo(() => [...leftTabs, ...rightTabs], [leftTabs, rightTabs]);
  const akademikTabs = useMemo(() => AKADEMIK_IDS.map((id) => allTabs.find((t) => t.id === id)).filter((t): t is NavTab => !!t), [allTabs]);
  const idariTabs = useMemo(() => IDARI_IDS.map((id) => allTabs.find((t) => t.id === id)).filter((t): t is NavTab => !!t), [allTabs]);

  const [openSheet, setOpenSheet] = useState<"akademik" | "idari" | "all" | null>(null);
  const [query, setQuery] = useState("");

  function handleSelect(id: string) {
    onSelect(id);
    setOpenSheet(null);
    setQuery("");
  }

  const isOverviewActive = activeTab === "overview";
  const isAkademikActive = AKADEMIK_IDS.includes(activeTab);
  const isIdariActive = IDARI_IDS.includes(activeTab);
  const isOtherActive = !isOverviewActive && !isAkademikActive && !isIdariActive;

  const normalizedQuery = query.toLocaleLowerCase("tr");
  const filteredLeft = leftTabs.filter((tab) => tab.label.toLocaleLowerCase("tr").includes(normalizedQuery));
  const filteredRight = rightTabs.filter((tab) => tab.label.toLocaleLowerCase("tr").includes(normalizedQuery));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-hairline bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-midnight/95 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button onClick={() => handleSelect("overview")} className="relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-2">
          {isOverviewActive && (
            <motion.span layoutId="principalMobilePill" className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <LayoutDashboard className={cn("h-5 w-5", isOverviewActive ? "text-brand-600" : "text-espresso/50 dark:text-cream/40")} />
          <span className={cn("text-[9px] leading-tight", isOverviewActive ? "font-semibold text-brand-600" : "text-espresso/50 dark:text-cream/40")}>
            Genel Bakış
          </span>
        </button>

        <button
          onClick={() => setOpenSheet(openSheet === "akademik" ? null : "akademik")}
          className="relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-2"
        >
          {isAkademikActive && (
            <motion.span layoutId="principalMobilePill" className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <GraduationCap className={cn("h-5 w-5", isAkademikActive ? "text-brand-600" : "text-espresso/50 dark:text-cream/40")} />
          <span className={cn("text-[9px] leading-tight", isAkademikActive ? "font-semibold text-brand-600" : "text-espresso/50 dark:text-cream/40")}>
            Akademik
          </span>
        </button>

        <button
          onClick={() => setOpenSheet(openSheet === "idari" ? null : "idari")}
          className="relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-2"
        >
          {isIdariActive && (
            <motion.span layoutId="principalMobilePill" className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <ClipboardList className={cn("h-5 w-5", isIdariActive ? "text-brand-600" : "text-espresso/50 dark:text-cream/40")} />
          <span className={cn("text-[9px] leading-tight", isIdariActive ? "font-semibold text-brand-600" : "text-espresso/50 dark:text-cream/40")}>
            İdari & Akış
          </span>
        </button>

        <button
          onClick={() => setOpenSheet(openSheet === "all" ? null : "all")}
          className="relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-2"
        >
          {isOtherActive && (
            <motion.span layoutId="principalMobilePill" className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
          )}
          <Grid3x3 className={cn("h-5 w-5", isOtherActive ? "text-brand-600" : "text-espresso/50 dark:text-cream/40")} />
          <span className={cn("text-[9px] leading-tight", isOtherActive ? "font-semibold text-brand-600" : "text-espresso/50 dark:text-cream/40")}>
            Tüm Modüller
          </span>
        </button>
      </nav>

      <BottomSheetShell isOpen={openSheet === "akademik"} onClose={() => setOpenSheet(null)}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-espresso dark:text-cream">Akademik</h3>
            <button onClick={() => setOpenSheet(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {akademikTabs.map((tab) => (
              <ModuleGridButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onClick={() => handleSelect(tab.id)} />
            ))}
          </div>
        </div>
      </BottomSheetShell>

      <BottomSheetShell isOpen={openSheet === "idari"} onClose={() => setOpenSheet(null)}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-espresso dark:text-cream">İdari & Akış</h3>
            <button onClick={() => setOpenSheet(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {idariTabs.map((tab) => (
              <ModuleGridButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onClick={() => handleSelect(tab.id)} />
            ))}
          </div>
        </div>
      </BottomSheetShell>

      <BottomSheetShell isOpen={openSheet === "all"} onClose={() => setOpenSheet(null)}>
        <div className="mb-2 flex shrink-0 items-center justify-between px-5 pt-3">
          <h3 className="text-sm font-semibold text-espresso dark:text-cream">Tüm Modüller</h3>
          <button onClick={() => setOpenSheet(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-espresso-muted hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="shrink-0 px-5 pb-3">
          <div className="flex items-center gap-2 rounded-xl border border-hairline bg-cream-card px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
            <Search className="h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Modül ara..."
              className="w-full bg-transparent text-sm text-espresso outline-none dark:text-cream"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {filteredLeft.length > 0 && (
            <>
              <p className="mb-2 mt-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                Akademik & Akış Modülleri
              </p>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {filteredLeft.map((tab) => (
                  <ModuleGridButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onClick={() => handleSelect(tab.id)} />
                ))}
              </div>
            </>
          )}
          {filteredRight.length > 0 && (
            <>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                İdari & Yönetim Araçları
              </p>
              <div className="grid grid-cols-2 gap-2">
                {filteredRight.map((tab) => (
                  <ModuleGridButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onClick={() => handleSelect(tab.id)} />
                ))}
              </div>
            </>
          )}
          {filteredLeft.length === 0 && filteredRight.length === 0 && (
            <p className="mt-4 text-center text-xs text-espresso-muted dark:text-cream/40">Sonuç bulunamadı.</p>
          )}
        </div>
      </BottomSheetShell>
    </>
  );
}
