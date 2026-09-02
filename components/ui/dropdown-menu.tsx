"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Faz Q — Röntgen paneli genel düzenlemesi: birden fazla ayrı ikon/pill
// butonu tek bir tetikleyici altında GRUPLAMAK için paylaşılan, hafif bir
// dropdown. Modal'daki Esc-ile-kapatma deseniyle AYNI + dışarı tıklayınca
// da kapanır. Modal'ın aksine tam ekranı KAPLAMAZ — küçük bir popover.
export function DropdownMenu({
  trigger,
  children,
  align = "right",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            onClick={() => setOpen(false)}
            className={cn(
              "absolute top-full z-30 mt-1.5 min-w-[200px] overflow-hidden rounded-xl border border-hairline bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-midnight-card",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  spinning,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  spinning?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition disabled:opacity-50",
        danger ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" : "text-espresso hover:bg-cream-card dark:text-cream dark:hover:bg-white/5"
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", spinning && "animate-spin")} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
