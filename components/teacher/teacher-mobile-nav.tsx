"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid3x3, X } from "lucide-react";
import type { NavTab } from "@/components/principal/floating-nav";
import { cn } from "@/lib/utils";

const QUICK_ACCESS_IDS = ["attendance", "quick-homework", "homework-matrix", "appointments"];

export function TeacherMobileNav({
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const allTabs = [...leftTabs, ...rightTabs];
  const quickTabs = QUICK_ACCESS_IDS.map((id) => allTabs.find((tab) => tab.id === id)).filter((tab): tab is NavTab => !!tab);

  function handleSelect(id: string) {
    onSelect(id);
    setIsDrawerOpen(false);
  }

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-hairline bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-midnight/95 md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {quickTabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => handleSelect(tab.id)}
              className="relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 py-2"
            >
              {isActive && (
                <motion.span layoutId="teacherMobilePill" className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-brand-600" transition={{ type: "spring", stiffness: 400, damping: 32 }} />
              )}
              <tab.icon className={cn("h-5 w-5", isActive ? "text-brand-600" : "text-espresso/50 dark:text-cream/40")} />
              <span className={cn("max-w-[62px] truncate text-[9px] leading-tight", isActive ? "font-semibold text-brand-600" : "text-espresso/50 dark:text-cream/40")}>
                {tab.label}
              </span>
            </button>
          );
        })}
        <button onClick={() => setIsDrawerOpen(true)} className="flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 py-2">
          <Grid3x3 className="h-5 w-5 text-espresso/50 dark:text-cream/40" />
          <span className="text-[9px] leading-tight text-espresso/50 dark:text-cream/40">Tümü</span>
        </button>
      </nav>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-espresso/40 backdrop-blur-sm md:hidden"
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
                if (info.offset.y > 110 || info.velocity.y > 500) setIsDrawerOpen(false);
              }}
              className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[80vh] flex-col rounded-t-3xl border-t border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card md:hidden"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex shrink-0 justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-hairline dark:bg-white/20" />
              </div>
              <div className="mb-2 flex shrink-0 items-center justify-between px-5 pt-3">
                <h3 className="text-sm font-semibold text-espresso dark:text-cream">Tüm Modüller</h3>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
                <p className="mb-2 mt-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  Ders & Sınıf Operasyonu
                </p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {leftTabs.map((tab) => (
                    <ModuleButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onClick={() => handleSelect(tab.id)} />
                  ))}
                </div>

                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  Analiz & Etüt/İletişim
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {rightTabs.map((tab) => (
                    <ModuleButton key={tab.id} tab={tab} isActive={tab.id === activeTab} onClick={() => handleSelect(tab.id)} />
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ModuleButton({ tab, isActive, onClick }: { tab: NavTab; isActive: boolean; onClick: () => void }) {
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
