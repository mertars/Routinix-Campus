"use client";

import { useSyncExternalStore } from "react";

// Komut paleti aç/kapa — depo React ağacından bağımsız (bkz.
// lib/student-360-store.ts, aynı gerekçe): paleti altı farklı üst
// çubuktaki tuş ve global ⌘K kısayolu açabiliyor.

let open = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openCommandPalette() {
  if (open) return;
  open = true;
  emit();
}

export function closeCommandPalette() {
  if (!open) return;
  open = false;
  emit();
}

export function useCommandPaletteOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => open,
    () => false
  );
}
