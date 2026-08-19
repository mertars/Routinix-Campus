"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// NOT: Yoklama, Ödev Masası, Pop-Quiz, Etüt/Randevu, Rehberlik ve
// Duyuru/Etkinlik/Acil Bildirim artık burada değil — gerçek Prisma/Postgres
// modellerine taşındı (bkz. app/api/). Bu dosyada sadece "Yıllık Plan"
// (Sınıf Defteri modülü) kaldı — henüz taşınmadı.

export type YearlyPlanRow = {
  id: string;
  teacherName: string;
  weekLabel: string;
  subtopicName: string;
  notes: string;
};

type LiveSyncData = {
  yearlyPlans: YearlyPlanRow[];
};

const DEFAULT_DATA: LiveSyncData = {
  yearlyPlans: [],
};

type LiveSyncValue = LiveSyncData & {
  addYearlyPlanRow: (item: Omit<YearlyPlanRow, "id">) => void;
};

const LiveSyncContext = createContext<LiveSyncValue | null>(null);

const STORAGE_KEY = "routinix-kampus-live-sync";

export function LiveSyncProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<LiveSyncData>(DEFAULT_DATA);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setData({ ...DEFAULT_DATA, ...JSON.parse(stored) });
    } catch {
      // yoksay
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // yoksay
    }
  }, [data, hydrated]);

  // Farklı bir sekmede (örn. /principal) yapılan değişiklik bu sekmeye de
  // anında yansısın diye 'storage' olayını dinliyoruz.
  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          setData({ ...DEFAULT_DATA, ...JSON.parse(event.newValue) });
        } catch {
          // yoksay
        }
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const value: LiveSyncValue = {
    ...data,
    addYearlyPlanRow: (item) =>
      setData((prev) => ({ ...prev, yearlyPlans: [{ ...item, id: crypto.randomUUID() }, ...prev.yearlyPlans] })),
  };

  return <LiveSyncContext.Provider value={value}>{children}</LiveSyncContext.Provider>;
}

export function useLiveSync() {
  const ctx = useContext(LiveSyncContext);
  if (!ctx) throw new Error("useLiveSync, LiveSyncProvider içinde kullanılmalı");
  return ctx;
}
