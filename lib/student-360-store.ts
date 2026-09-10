"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Student360 } from "@/lib/student-360-types";

// ÖĞRENCİ 360 DEPOSU — karta "her yerden" tıklanabilmesi için.
//
// Kart tek bir yerde (kök düzende) mount edilir; açma çağrısı ise
// uygulamanın herhangi bir köşesinden gelebilir: kurum genelinde arama
// sonucu, öğrenci listesi, ödeme ekranındaki satır, gündem maddesi...
// Bunların ortak bir React atası YOK — sağlayıcı zinciriyle çözülemez.
// Bu yüzden depo React ağacından bağımsız duruyor (bkz. lib/agenda-store.ts,
// aynı gerekçe).

type State = {
  /** null = kart kapalı. */
  studentId: string | null;
  data: Student360 | null;
  loading: boolean;
  /** Yüklenemedi (yetki yok / kayıt yok). */
  failed: boolean;
};

const CLOSED: State = { studentId: null, data: null, loading: false, failed: false };

let state: State = CLOSED;
const listeners = new Set<() => void>();

function publish(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openStudent360(studentId: string) {
  // Aynı öğrenci yeniden açılırsa veri korunur — liste ↔ kart arasında
  // gidip gelirken beklemek gerekmesin.
  if (state.studentId === studentId && state.data) {
    publish({ ...state });
    return;
  }
  publish({ studentId, data: null, loading: true, failed: false });

  void (async () => {
    try {
      const res = await fetch(`/api/students/${studentId}/360`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Student360;
      // Kullanıcı bu arada kartı kapattıysa ya da başka öğrenci açtıysa
      // geç gelen yanıt ekranı ELE GEÇİRMEMELİ.
      if (state.studentId !== studentId) return;
      publish({ studentId, data, loading: false, failed: false });
    } catch {
      if (state.studentId !== studentId) return;
      publish({ studentId, data: null, loading: false, failed: true });
    }
  })();
}

export function closeStudent360() {
  publish(CLOSED);
}

export function useStudent360() {
  const snapshot = useSyncExternalStore(subscribe, () => state, () => CLOSED);
  const close = useCallback(() => closeStudent360(), []);

  // Esc ile kapanır — Modal'daki aynı desen, ama kart kendi mount'unda
  // yaşadığı için burada kuruluyor.
  useEffect(() => {
    if (!snapshot.studentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStudent360();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [snapshot.studentId]);

  return { ...snapshot, close };
}
