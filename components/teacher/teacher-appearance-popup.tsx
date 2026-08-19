"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RotateCcw, Palette } from "lucide-react";
import { useAccent } from "@/lib/accent-context";
import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from "@/lib/color-utils";
import { ThemeToggle } from "@/components/theme-toggle";

export function TeacherAppearancePopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { hex, setAccent, resetAccent } = useAccent();
  const isDefaultAccent = hex.toLowerCase() === DEFAULT_ACCENT_HEX.toLowerCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-espresso/50 backdrop-blur-sm"
          />
          <div className="fixed left-1/2 top-1/2 z-[80] w-[88vw] max-w-xs -translate-x-1/2 -translate-y-1/2">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="rounded-3xl border border-white/10 bg-[#1C1512]/95 p-6 text-cream shadow-2xl backdrop-blur-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-cream">Görünüm</h3>
                <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-cream/60 transition hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cream/50">
                <Palette className="h-3.5 w-3.5" /> Vurgu Rengi
              </p>
              <div className="mb-3 grid grid-cols-5 gap-2">
                {ACCENT_PRESETS.map((preset) => {
                  const isActive = preset.hex.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => setAccent(preset.hex)}
                      title={preset.label}
                      aria-label={preset.label}
                      className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 transition"
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
              <button
                onClick={resetAccent}
                disabled={isDefaultAccent}
                className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2.5 text-xs font-medium text-cream/60 transition hover:bg-white/5 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Varsayılana Dön
              </button>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cream/50">Tema</p>
              <div className="flex items-center justify-between rounded-xl border border-white/15 px-3.5 py-2.5">
                <span className="text-xs text-cream/70">Gece / Gündüz Modu</span>
                <ThemeToggle />
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
