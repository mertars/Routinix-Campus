"use client";

import { useCallback, useEffect, useState } from "react";

export type InstitutionCounts = {
  activeStudents: number;
  activeTeachers: number;
  branches: number;
  /** Ayrılmış ama borcu kapanmamış öğrenciler (ödeme panelinde görünür). */
  departedWithDebt: number;
};

// Kurum sayıları için TEK istemci kaynağı.
//
// useInstitutionName'daki aynı desen: aynı sayfadaki birden fazla
// tüketici (üst bar + bir sekme başlığı) tek istek atsın diye modül
// seviyesinde önbelleklenir.
//
// Önbellek, sayıyı değiştiren bir işlemden sonra refreshInstitutionCounts()
// ile düşürülür — toplu pasifleştirmeden sonra üst barın eski sayıyı
// göstermesi, sayının hiç olmamasından kötüdür.
let cached: InstitutionCounts | null = null;
let inflight: Promise<InstitutionCounts | null> | null = null;
const listeners = new Set<(c: InstitutionCounts | null) => void>();

function fetchCounts(): Promise<InstitutionCounts | null> {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetch("/api/admin/counts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: InstitutionCounts | null) => {
        cached = data;
        return data;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function refreshInstitutionCounts(): void {
  cached = null;
  void fetchCounts().then((c) => listeners.forEach((fn) => fn(c)));
}

export function useInstitutionCounts(): InstitutionCounts | null {
  const [counts, setCounts] = useState<InstitutionCounts | null>(cached);

  const subscribe = useCallback((fn: (c: InstitutionCounts | null) => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  useEffect(() => {
    void fetchCounts().then(setCounts);
    return subscribe(setCounts);
  }, [subscribe]);

  return counts;
}
