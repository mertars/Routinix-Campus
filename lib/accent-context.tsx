"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_ACCENT_HEX, generateAccentRamp, type AccentRamp } from "./color-utils";

type AccentContextValue = {
  hex: string;
  setAccent: (hex: string) => void;
  resetAccent: () => void;
};

const AccentContext = createContext<AccentContextValue | null>(null);

const STORAGE_KEY = "routinix-kampus-accent";

function applyRamp(ramp: AccentRamp) {
  const root = document.documentElement.style;
  Object.entries(ramp).forEach(([shade, value]) => {
    root.setProperty(`--brand-${shade}`, value);
  });
}

export function AccentProvider({ children }: { children: ReactNode }) {
  const [hex, setHex] = useState(DEFAULT_ACCENT_HEX);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { hex: string };
        setHex(parsed.hex);
      }
    } catch {
      // localStorage erişilemiyor (gizli sekme vb.) — varsayılan turuncu ile devam et.
    }
  }, []);

  function setAccent(nextHex: string) {
    setHex(nextHex);
    const ramp = generateAccentRamp(nextHex);
    applyRamp(ramp);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ hex: nextHex, ramp }));
    } catch {
      // yoksay
    }
  }

  function resetAccent() {
    setAccent(DEFAULT_ACCENT_HEX);
  }

  return <AccentContext.Provider value={{ hex, setAccent, resetAccent }}>{children}</AccentContext.Provider>;
}

export function useAccent() {
  const ctx = useContext(AccentContext);
  if (!ctx) throw new Error("useAccent, AccentProvider içinde kullanılmalı");
  return ctx;
}
