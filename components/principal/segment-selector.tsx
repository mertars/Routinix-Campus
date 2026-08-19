"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe2, Target, GraduationCap, Trophy, ChevronDown, X, type LucideIcon } from "lucide-react";
import type { Segment } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type MenuOption = { id: Segment; label: string };

const LGS_OPTIONS: MenuOption[] = [
  { id: "LGS", label: "Tüm LGS Kademesi" },
  { id: 5, label: "5. Sınıf" },
  { id: 6, label: "6. Sınıf" },
  { id: 7, label: "7. Sınıf" },
  { id: 8, label: "8. Sınıf (LGS)" },
];

const YKS_OPTIONS: MenuOption[] = [
  { id: "YKS", label: "Tüm YKS Kademesi" },
  { id: 9, label: "9. Sınıf" },
  { id: 10, label: "10. Sınıf" },
  { id: 11, label: "11. Sınıf" },
  { id: 12, label: "12. Sınıf (YKS)" },
];

const ACTIVE_FILTER_LABEL: Record<string, { label: string; icon: LucideIcon }> = {
  LGS: { label: "LGS Kademesi", icon: Target },
  YKS: { label: "YKS Kademesi", icon: GraduationCap },
  MEZUN: { label: "Mezun Grubu", icon: Trophy },
  "5": { label: "5. Sınıf", icon: Target },
  "6": { label: "6. Sınıf", icon: Target },
  "7": { label: "7. Sınıf", icon: Target },
  "8": { label: "8. Sınıf (LGS)", icon: Target },
  "9": { label: "9. Sınıf", icon: GraduationCap },
  "10": { label: "10. Sınıf", icon: GraduationCap },
  "11": { label: "11. Sınıf", icon: GraduationCap },
  "12": { label: "12. Sınıf (YKS)", icon: GraduationCap },
};

function isLgsFamily(segment: Segment) {
  return segment === "LGS" || (typeof segment === "number" && segment <= 8);
}
function isYksFamily(segment: Segment) {
  return segment === "YKS" || (typeof segment === "number" && segment >= 9);
}

function TriggerPill({
  isActive,
  onClick,
  layoutId,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  layoutId: string;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className="relative flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-medium">
      {isActive && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-full bg-brand-600 shadow-[0_0_16px_rgb(var(--brand-600)/0.45)]"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      <span
        className={cn(
          "relative z-10 flex items-center gap-1.5 transition-colors",
          isActive ? "text-white" : "text-espresso-muted hover:text-brand-600 dark:text-cream/50 dark:hover:text-brand-400"
        )}
      >
        {children}
      </span>
    </button>
  );
}

function DropdownTrigger({
  label,
  icon: Icon,
  isActive,
  isOpen,
  onToggle,
  options,
  selected,
  onSelect,
}: {
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isOpen: boolean;
  onToggle: () => void;
  options: MenuOption[];
  selected: Segment;
  onSelect: (id: Segment) => void;
}) {
  return (
    <div className="relative">
      <TriggerPill isActive={isActive} onClick={onToggle} layoutId="segmentPill">
        <Icon className="h-3.5 w-3.5" />
        {label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")} />
      </TriggerPill>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="absolute left-0 top-full z-[9999] mt-2 w-48 overflow-hidden rounded-2xl border border-white/15 bg-[#1C1512]/95 p-1.5 shadow-2xl backdrop-blur-2xl"
          >
            {options.map((option) => (
              <button
                key={String(option.id)}
                onClick={() => onSelect(option.id)}
                className={cn(
                  "flex w-full items-center rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors",
                  selected === option.id ? "bg-brand-600 text-white" : "text-cream/80 hover:bg-brand-600/20 hover:text-brand-300"
                )}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileGridButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  hasChevron,
}: {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
  hasChevron?: boolean;
}) {
  return (
    <button onClick={onClick} className="relative min-h-[56px] overflow-hidden rounded-2xl">
      {isActive && (
        <motion.span
          layoutId="segmentPillMobile"
          className="absolute inset-0 rounded-2xl bg-brand-600 shadow-[0_0_16px_rgb(var(--brand-600)/0.45)]"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      )}
      <span
        className={cn(
          "relative z-10 flex h-full min-h-[56px] flex-col items-center justify-center gap-1 border px-2 py-1.5 text-center",
          isActive ? "border-transparent text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
        )}
      >
        <span className="flex items-center gap-1">
          <Icon className="h-4 w-4" />
          {hasChevron && <ChevronDown className="h-3 w-3" />}
        </span>
        <span className="text-[11px] font-medium leading-tight">{label}</span>
      </span>
    </button>
  );
}

function MobileSheet({
  isOpen,
  onClose,
  title,
  options,
  selected,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: MenuOption[];
  selected: Segment;
  onSelect: (id: Segment) => void;
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
            className="fixed inset-0 z-[70] bg-espresso/40 backdrop-blur-sm"
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
            className="fixed inset-x-0 bottom-0 z-[80] rounded-t-3xl border-t border-white/15 bg-[#1C1512]/95 shadow-2xl backdrop-blur-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-2.5">
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>
            <div className="px-5 pb-6 pt-3">
              <p className="mb-3 text-sm font-semibold text-cream">{title}</p>
              <div className="space-y-1.5">
                {options.map((option) => (
                  <button
                    key={String(option.id)}
                    onClick={() => onSelect(option.id)}
                    className={cn(
                      "flex min-h-[48px] w-full items-center rounded-xl px-4 text-left text-sm font-medium transition-colors",
                      selected === option.id ? "bg-brand-600 text-white" : "text-cream/80 hover:bg-white/5"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function SegmentSelector({ selected, onSelect }: { selected: Segment; onSelect: (segment: Segment) => void }) {
  const [openMenu, setOpenMenu] = useState<"LGS" | "YKS" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    }
    if (openMenu) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  function handleSelect(id: Segment) {
    onSelect(id);
    setOpenMenu(null);
  }

  const activeFilter = selected !== "ALL" ? ACTIVE_FILTER_LABEL[String(selected)] : undefined;

  return (
    <div ref={containerRef} className="relative z-50">
      {/* Masaüstü: tek satır bar + açılır popover'lar (değişmedi) */}
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <div className="inline-flex h-10 items-center gap-1 rounded-full border border-hairline bg-white/70 px-1 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70">
          <TriggerPill isActive={selected === "ALL"} onClick={() => handleSelect("ALL")} layoutId="segmentPill">
            <Globe2 className="h-3.5 w-3.5" /> Genel
          </TriggerPill>

          <DropdownTrigger
            label="LGS / Ortaokul"
            icon={Target}
            isActive={isLgsFamily(selected)}
            isOpen={openMenu === "LGS"}
            onToggle={() => setOpenMenu((prev) => (prev === "LGS" ? null : "LGS"))}
            options={LGS_OPTIONS}
            selected={selected}
            onSelect={handleSelect}
          />

          <DropdownTrigger
            label="YKS / Lise"
            icon={GraduationCap}
            isActive={isYksFamily(selected)}
            isOpen={openMenu === "YKS"}
            onToggle={() => setOpenMenu((prev) => (prev === "YKS" ? null : "YKS"))}
            options={YKS_OPTIONS}
            selected={selected}
            onSelect={handleSelect}
          />

          <TriggerPill isActive={selected === "MEZUN"} onClick={() => handleSelect("MEZUN")} layoutId="segmentPill">
            <Trophy className="h-3.5 w-3.5" /> Mezun Grubu
          </TriggerPill>
        </div>

        <AnimatePresence>
          {activeFilter && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9, x: -6 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => onSelect("ALL")}
              className="flex h-10 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-300 dark:hover:bg-brand-600/25"
            >
              <activeFilter.icon className="h-3.5 w-3.5" />
              Filtre: {activeFilter.label}
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Mobil: 2x2 grid + alttan açılan seçim çekmecesi */}
      <div className="md:hidden">
        <div className="grid grid-cols-2 gap-2">
          <MobileGridButton icon={Globe2} label="Genel" isActive={selected === "ALL"} onClick={() => handleSelect("ALL")} />
          <MobileGridButton
            icon={Trophy}
            label="Mezun Grubu"
            isActive={selected === "MEZUN"}
            onClick={() => handleSelect("MEZUN")}
          />
          <MobileGridButton
            icon={Target}
            label="LGS / Ortaokul"
            isActive={isLgsFamily(selected)}
            onClick={() => setOpenMenu("LGS")}
            hasChevron
          />
          <MobileGridButton
            icon={GraduationCap}
            label="YKS / Lise"
            isActive={isYksFamily(selected)}
            onClick={() => setOpenMenu("YKS")}
            hasChevron
          />
        </div>

        <AnimatePresence>
          {activeFilter && (
            <motion.button
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              onClick={() => onSelect("ALL")}
              className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100 dark:bg-brand-600/15 dark:text-brand-300 dark:hover:bg-brand-600/25"
            >
              <activeFilter.icon className="h-3.5 w-3.5" />
              Filtre: {activeFilter.label}
              <X className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>

        <MobileSheet
          isOpen={openMenu === "LGS"}
          onClose={() => setOpenMenu(null)}
          title="LGS / Ortaokul Kademesi"
          options={LGS_OPTIONS}
          selected={selected}
          onSelect={handleSelect}
        />
        <MobileSheet
          isOpen={openMenu === "YKS"}
          onClose={() => setOpenMenu(null)}
          title="YKS / Lise Kademesi"
          options={YKS_OPTIONS}
          selected={selected}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
