"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toBadges, type NavBadge, type TodayTask } from "@/lib/today-badges";

export type { NavBadge, TaskUrgency, TodayTask } from "@/lib/today-badges";

type TodayContextValue = {
  /** null = yüklenemedi (panel kendini gizler), [] = bekleyen iş yok. */
  tasks: TodayTask[] | null;
  loading: boolean;
  reload: () => void;
  /** Sekme id'si → o sekmede bekleyen iş. Menü rozetleri buradan çizilir. */
  badges: Record<string, NavBadge>;
};

const TodayContext = createContext<TodayContextValue>({
  tasks: null,
  loading: false,
  reload: () => {},
  badges: {},
});

export function useToday() {
  return useContext(TodayContext);
}

// "Bugün" verisini TEK yerden çeker.
//
// Bu veriyi iki yüzey birden kullanıyor: Bugün paneli (liste) ve yan
// menü adaları (ikon rozetleri). İkisi ayrı ayrı fetch etseydi her
// panel açılışında aynı sorgu iki kez koşardı — bu uç nokta ~450 ms
// sürüyor, ikiye katlanacak bir maliyet değil.
export function TodayProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TodayTask[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/today");
      const data = res.ok ? await res.json() : null;
      setTasks(data?.tasks ?? null);
    } catch {
      setTasks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Sekmeye gidip işi yapan müdür geri döndüğünde güncel sayıyı görsün.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const value = useMemo<TodayContextValue>(
    () => ({ tasks, loading, reload: () => void load(), badges: toBadges(tasks) }),
    [tasks, loading, load]
  );

  return <TodayContext.Provider value={value}>{children}</TodayContext.Provider>;
}
