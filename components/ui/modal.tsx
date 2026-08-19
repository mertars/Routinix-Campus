"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useIsMobile } from "@/lib/use-media-query";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  variant = "auto",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  // "auto" (varsayılan): mobilde Bottom Sheet, masaüstünde ortada kart.
  // "center": bilgilendirici/detay popup'ları (Arşiv, Analiz vb.) için — her
  // ekran boyutunda ortada açılır, sağ üstte her zaman net bir X butonu olur.
  variant?: "auto" | "center";
}) {
  const isMobileQuery = useIsMobile();
  const isMobile = variant === "auto" && isMobileQuery;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-espresso/40 backdrop-blur-sm"
          />

          {isMobile ? (
            // Mobilde: alttan süzülen, aşağı sürükleyip kapatılabilen Bottom Sheet.
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
              className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-3xl border-t border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex shrink-0 justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-hairline dark:bg-white/20" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-espresso dark:text-cream">{title}</h3>
                  <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {children}
              </div>
            </motion.div>
          ) : (
            // Masaüstünde: ekran ortasında sabit kart (davranış değişmedi).
            <div className="fixed left-1/2 top-1/2 z-[70] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 12 }}
                transition={{ type: "spring", stiffness: 300, damping: 28 }}
                className="max-h-[80vh] overflow-y-auto rounded-3xl border border-hairline bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-midnight-card"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-espresso dark:text-cream">{title}</h3>
                  <button
                    onClick={onClose}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/50 dark:hover:bg-white/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {children}
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
