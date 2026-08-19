"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type ToastItem = { id: string; tone: ToastTone; message: string };

type ToastContextValue = {
  showToast: (tone: ToastTone, message: string) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: "bg-green-600",
  error: "bg-rose-600",
  info: "bg-espresso dark:bg-brand-600",
};

const TONE_ICON: Record<ToastTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: AlertCircle,
};

// Uygulama genelinde, herhangi bir bileşenden `useToast()` ile tetiklenebilen
// tek bir bildirim yığını. API çağrılarının 4xx/5xx hatalarını kullanıcıya
// anlaşılır Türkçe metinlerle göstermek için kullanılır (bkz. proje
// check-up talimatındaki "Kullanıcı Dostu Toast Hata Mesajları" maddesi).
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((tone: ToastTone, message: string) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setItems((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const showError = useCallback((message: string) => showToast("error", message), [showToast]);
  const showSuccess = useCallback((message: string) => showToast("success", message), [showToast]);

  function dismiss(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <AnimatePresence>
          {items.map((item) => {
            const Icon = TONE_ICON[item.tone];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 16, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 340, damping: 28 }}
                className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium text-white shadow-xl", TONE_STYLES[item.tone])}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="flex-1">{item.message}</span>
                <button onClick={() => dismiss(item.id)} className="shrink-0 text-white/70 transition hover:text-white" aria-label="Kapat">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast, ToastProvider içinde kullanılmalı");
  return ctx;
}
