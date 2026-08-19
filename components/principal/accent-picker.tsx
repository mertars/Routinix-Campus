"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Check, RotateCcw } from "lucide-react";
import { useAccent } from "@/lib/accent-context";
import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from "@/lib/color-utils";
import { useIsMobile } from "@/lib/use-media-query";

function PickerBody({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function AccentPicker() {
  const { hex, setAccent, resetAccent } = useAccent();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen && !isMobile) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobile]);

  const isDefault = hex.toLowerCase() === DEFAULT_ACCENT_HEX.toLowerCase();

  const content = (
    <PickerBody>
      <p className="mb-3 text-xs font-semibold text-espresso dark:text-cream">Vurgu Rengi</p>

      <div className="mb-4 grid grid-cols-5 gap-2">
        {ACCENT_PRESETS.map((preset) => {
          const isActive = preset.hex.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={preset.hex}
              onClick={() => setAccent(preset.hex)}
              title={preset.label}
              aria-label={preset.label}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition"
              style={{ backgroundColor: preset.hex, borderColor: isActive ? preset.hex : "transparent" }}
            >
              {isActive && (
                <span className="flex h-full w-full items-center justify-center rounded-full bg-black/20">
                  <Check className="h-4 w-4 text-white" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <label className="mb-4 flex items-center gap-2 rounded-xl border border-hairline px-2.5 py-2.5 dark:border-white/10">
        <input
          type="color"
          value={hex}
          onChange={(event) => setAccent(event.target.value)}
          aria-label="Özel renk seç"
          className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
        />
        <span className="text-xs text-espresso-muted dark:text-cream/40">Özel Renk Seç</span>
        <span className="ml-auto font-mono text-[11px] uppercase text-espresso dark:text-cream">{hex}</span>
      </label>

      <button
        onClick={resetAccent}
        disabled={isDefault}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-2.5 text-xs font-medium text-espresso-muted transition hover:bg-cream-card disabled:opacity-40 dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Varsayılana Dön
      </button>
    </PickerBody>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((value) => !value)}
        aria-label="Vurgu rengini özelleştir"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm backdrop-blur-sm transition hover:border-brand-600/40 hover:text-brand-600 dark:border-white/10 dark:bg-midnight-card/70 dark:text-cream"
      >
        <Palette className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {isOpen &&
          (isMobile ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsOpen(false)}
                className="fixed inset-0 z-[60] bg-espresso/40 backdrop-blur-sm"
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
                  if (info.offset.y > 110 || info.velocity.y > 500) setIsOpen(false);
                }}
                className="fixed inset-x-0 bottom-0 z-[70] rounded-t-3xl border-t border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <div className="flex justify-center pt-2.5">
                  <span className="h-1.5 w-10 rounded-full bg-hairline dark:bg-white/20" />
                </div>
                <div className="px-5 pb-6 pt-2">{content}</div>
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -8 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-white/20 bg-white/80 p-4 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-midnight-card/80"
            >
              {content}
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}
