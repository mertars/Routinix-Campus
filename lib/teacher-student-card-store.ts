"use client";

import { useCallback, useSyncExternalStore } from "react";

// ÖĞRETMEN ÖĞRENCİ KARTI DEPOSU.
//
// lib/student-360-store.ts ile AYNI desen ve AYNI gerekçe: kart TEK yerde
// (öğretmen sayfasının kökünde) mount edilir, açma çağrısı ise herhangi bir
// sekmeden gelir — yoklama listesindeki isim, ödev matrisindeki satır, ısı
// haritasındaki hücre. Bunların ortak bir React atası yok.
//
// ⚠️ Yönetici kartından (student-360) ayrı bir depo: iki kart AYNI ANDA
// açılamamalı ve öğretmen panelinde 360 hiç açılmaz — öğretmen kendi
// dersine özel kartı görür (bkz. components/teacher/student-card-sheet.tsx).

let openId: string | null = null;
const listeners = new Set<() => void>();

function publish(next: string | null) {
  openId = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openTeacherStudentCard(studentId: string) {
  publish(studentId);
}

export function closeTeacherStudentCard() {
  publish(null);
}

export function useTeacherStudentCard() {
  const studentId = useSyncExternalStore(subscribe, () => openId, () => null);
  const close = useCallback(() => closeTeacherStudentCard(), []);
  return { studentId, close };
}
