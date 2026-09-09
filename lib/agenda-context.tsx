"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toBadges, type NavBadge } from "@/lib/agenda-badges";
import { HORIZON_ORDER } from "@/lib/agenda-types";
import type { Agenda, AgendaCounts, AgendaHorizon, AgendaItem } from "@/lib/agenda-types";

const EMPTY_COUNTS: AgendaCounts = {
  ...(Object.fromEntries(HORIZON_ORDER.map((h) => [h, 0])) as Record<AgendaHorizon, number>),
  critical: 0,
};

type AgendaContextValue = {
  /** null = yüklenemedi (panel kendini gizler), [] = bekleyen iş yok. */
  items: AgendaItem[] | null;
  counts: AgendaCounts;
  loading: boolean;
  reload: () => void;
  /** Sekme id'si → o sekmede bekleyen iş. Menü rozetleri buradan çizilir. */
  badges: Record<string, NavBadge>;
};

const AgendaCtx = createContext<AgendaContextValue>({
  items: null,
  counts: EMPTY_COUNTS,
  loading: false,
  reload: () => {},
  badges: {},
});

export function useAgenda() {
  return useContext(AgendaCtx);
}

// Gündem verisini TEK yerden çeker.
//
// Bu veriyi iki yüzey birden kullanıyor: Genel Bakış'taki Gündem paneli
// (gruplu liste) ve yan menü adaları (ikon rozetleri). İkisi ayrı ayrı
// fetch etseydi her panel açılışında 23 sayım sorgusu iki kez koşardı.
export function AgendaProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Agenda | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/agenda");
      setData(res.ok ? ((await res.json()) as Agenda) : null);
    } catch {
      setData(null);
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

  const value = useMemo<AgendaContextValue>(
    () => ({
      items: data?.items ?? null,
      counts: data?.counts ?? EMPTY_COUNTS,
      loading,
      reload: () => void load(),
      badges: toBadges(data?.items ?? null),
    }),
    [data, loading, load]
  );

  return <AgendaCtx.Provider value={value}>{children}</AgendaCtx.Provider>;
}
