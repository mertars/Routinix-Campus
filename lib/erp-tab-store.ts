"use client";

import type { ErpTabId } from "@/lib/erp-tabs";

// "ERP'de şu sekmeyi aç" isteği — iki farklı duruma TEK çağrı.
//
// ERP'de sekme seçimi adreste taşınmıyor, bileşen state'inde duruyor.
// Bu yüzden dışarıdan gelen bir istek iki ayrı şekilde karşılanmalı:
//
//   - Müdür ZATEN /principal'daysa: sayfa açık, anında geçilmeli.
//     (sessionStorage yazmak işe yaramaz — sayfa yeniden mount olmuyor,
//      dolayısıyla kimse okumuyor.)
//   - Başka moduldeyse: istek bırakılır, sayfa açılırken alır.
//
// Çağıran bu ayrımı bilmek zorunda kalmasın diye tek fonksiyon:
// requestErpTab true dönerse iş bitti, false dönerse yönlendirme gerek.

const PENDING_KEY = "routinix-erp-tab";

type Listener = (tab: ErpTabId) => void;
const listeners = new Set<Listener>();

/** @returns Sayfa açıktı ve geçiş yapıldıysa true; çağıran yönlendirmemeli. */
export function requestErpTab(tab: ErpTabId): boolean {
  if (listeners.size > 0) {
    for (const listener of listeners) listener(tab);
    return true;
  }
  try {
    window.sessionStorage.setItem(PENDING_KEY, tab);
  } catch {
    // yoksay — istek kaybolur, müdür sekmeye elle geçer
  }
  return false;
}

export function subscribeErpTab(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Bekleyen isteği alır ve SİLER — yenilemede aynı sekmeye yapışıp
 * kalmasın.
 */
export function consumePendingErpTab(): string | null {
  try {
    const pending = window.sessionStorage.getItem(PENDING_KEY);
    if (pending) window.sessionStorage.removeItem(PENDING_KEY);
    return pending;
  } catch {
    return null;
  }
}
