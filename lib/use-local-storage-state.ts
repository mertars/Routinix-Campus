"use client";

import { useEffect, useState } from "react";

// SSR güvenli localStorage-backed state — ilk render'da her zaman 'initial'
// döner (hydration mismatch olmasın diye), ardından effect içinde gerçek
// değeri okuyup senkronize eder.
export function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setValue(JSON.parse(stored));
    } catch {
      // yoksay
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // yoksay
    }
  }, [key, value, hydrated]);

  return [value, setValue] as const;
}
