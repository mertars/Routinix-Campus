"use client";

import { useSyncExternalStore } from "react";

// REHBERLİĞİN TESPİT SEPETİ — "Akademik Durum"da işaretlenenler, program
// yazarken ekranın kenarında durur.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "yapmadığı ödev, katılmadığı ders,
// hepsinde artı tuşu olsun; seçilenler küçük bir ekranda gözüksün ve
// program yaza tıklandığında 'sizin tespitleriniz' diye bir kısımda
// toplansın... durmadan oraya git buraya git'le uğraşmasın."
//
// ⚠️ NEDEN REACT AĞACININ DIŞINDA: seçim TAM EKRAN Akademik Durum
// panelinde yapılıyor, tüketen ekran ise BAŞKA BİR SEKMEDEKİ program
// yapıcı. Ortak bir React ataları yok (panel portal ile body'ye
// taşınıyor) — sağlayıcı zinciriyle çözülemez. Aynı gerekçe
// lib/student-360-store.ts ve lib/agenda-store.ts'te de geçerli.
//
// Sepet BELLEKTE durur: sayfa yenilenince silinir. Bilerek — tespitler
// "şu an yazdığım program için" toplanır, kalıcı bir kayıt değildir.

export type FindingKind = "homework" | "attendance" | "mastery" | "video" | "xray" | "exam";

export type Finding = {
  /** Kaynak kaydın kimliği — aynı şey iki kez eklenmesin. */
  id: string;
  kind: FindingKind;
  label: string;
  detail: string;
  /** Program bloğu önerilirken kullanılacak ders (biliniyorsa). */
  subject?: string | null;
};

type State = { studentId: string | null; items: Finding[] };

let state: State = { studentId: null, items: [] };
const listeners = new Set<() => void>();

function publish(next: State) {
  state = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Bir tespiti ekler/çıkarır. Öğrenci değiştiyse sepet sıfırlanır —
 *  bir öğrencinin tespitleriyle başkasına program yazılmamalı. */
export function toggleFinding(studentId: string, finding: Finding) {
  const sameStudent = state.studentId === studentId;
  const items = sameStudent ? state.items : [];
  const exists = items.some((f) => f.id === finding.id);
  publish({
    studentId,
    items: exists ? items.filter((f) => f.id !== finding.id) : [...items, finding],
  });
}

export function removeFinding(id: string) {
  publish({ ...state, items: state.items.filter((f) => f.id !== id) });
}

export function clearFindings() {
  publish({ studentId: null, items: [] });
}

function getSnapshot(): State {
  return state;
}

const SERVER_SNAPSHOT: State = { studentId: null, items: [] };

export function useFindings(studentId?: string | null): Finding[] {
  const snap = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
  if (studentId && snap.studentId !== studentId) return [];
  return snap.items;
}
