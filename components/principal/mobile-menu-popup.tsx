"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RotateCcw, Palette, LogOut } from "lucide-react";
import { useAccent } from "@/lib/accent-context";
import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from "@/lib/color-utils";
import { useLogout } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";

// Alttan yukarı açılan tam genişlikli sheet — principal-mobile-nav.tsx'teki
// BottomSheetShell ile AYNI desen (sürükleyerek kapatma, safe-area alt
// boşluğu, yuvarlatılmış üst köşeler) — önceden ekran ortasında sıkışan
// küçük bir kart (w-[90vw] max-w-sm, -translate-x/y-1/2) modaldi.
export function MobileMenuPopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { hex, setAccent, resetAccent } = useAccent();
  const logout = useLogout();
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
            className="fixed inset-0 z-[70] bg-espresso/60 backdrop-blur-sm md:hidden"
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
            className="fixed inset-x-0 bottom-0 z-[80] flex w-full max-h-[88vh] flex-col rounded-t-3xl border-t border-white/10 bg-midnight-card/95 text-cream shadow-2xl backdrop-blur-2xl md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex shrink-0 justify-center pt-2.5">
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-cream">Ayarlar</h3>
                <button
                  onClick={onClose}
                  aria-label="Menüyü kapat"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-cream/60 transition hover:bg-white/10"
                >
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
              <label className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 px-2.5 py-2.5">
                <input
                  type="color"
                  value={hex}
                  onChange={(event) => setAccent(event.target.value)}
                  aria-label="Özel renk seç"
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                />
                <span className="text-xs text-cream/50">Özel Renk Seç</span>
                <span className="ml-auto font-mono text-[11px] uppercase text-cream">{hex}</span>
              </label>
              <button
                onClick={resetAccent}
                disabled={isDefaultAccent}
                className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2.5 text-xs font-medium text-cream/60 transition hover:bg-white/5 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Varsayılana Dön
              </button>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cream/50">Tema</p>
              <div className="mb-6 flex items-center justify-between rounded-xl border border-white/15 px-3.5 py-2.5">
                <span className="text-xs text-cream/70">Gece / Gündüz Modu</span>
                <ThemeToggle />
              </div>

              <button
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
              >
                <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
