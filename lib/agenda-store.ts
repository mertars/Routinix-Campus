"use client";

import { useEffect, useSyncExternalStore } from "react";
import { toBadges, type NavBadge } from "@/lib/agenda-badges";
import { moduleFromHref, MODULES, type ModuleId } from "@/lib/modules";
import { HORIZON_ORDER, type Agenda, type AgendaCounts, type AgendaHorizon, type AgendaItem } from "@/lib/agenda-types";

// GÜNDEM DEPOSU — React ağacından bağımsız, tek kaynak.
//
// Önce bir Provider'dı ve yalnızca /principal ağacını sarıyordu. Artık
// gündem verisini BEŞ modülün üst çubuğu da okuyor (modül değiştiricideki
// "burada 3 iş bekliyor" rozetleri): her modülün sayfasını ayrı bir
// sağlayıcıyla sarmak, hepsinin ayrı fetch atması demekti.
//
// Depo modül seviyesinde durduğu için Next'in istemci-taraflı gezinmesinde
// AYAKTA KALIYOR: ERP'den Ödeme'ye geçince sayılar anında doğru, yeniden
// istek atılmıyor.

const EMPTY_COUNTS: AgendaCounts = {
  ...(Object.fromEntries(HORIZON_ORDER.map((h) => [h, 0])) as Record<AgendaHorizon, number>),
  critical: 0,
};

export type ModuleWork = { count: number; critical: number };

export type AgendaSnapshot = {
  /** null = henüz yüklenmedi ya da yüklenemedi (panel kendini gizler). */
  items: AgendaItem[] | null;
  counts: AgendaCounts;
  loading: boolean;
  /** ERP sekmesi → rozet. Yan menü adaları bunu okur. */
  badges: Record<string, NavBadge>;
  /** Modül → o modülde bekleyen iş. Modül değiştirici bunu okur. */
  moduleWork: Record<ModuleId, ModuleWork>;
  /** En son ne zaman yüklendi (ms). 0 = hiç. */
  loadedAt: number;
};

const EMPTY_MODULE_WORK = Object.fromEntries(MODULES.map((m) => [m.id, { count: 0, critical: 0 }])) as Record<
  ModuleId,
  ModuleWork
>;

const INITIAL: AgendaSnapshot = {
  items: null,
  counts: EMPTY_COUNTS,
  loading: false,
  badges: {},
  moduleWork: EMPTY_MODULE_WORK,
  loadedAt: 0,
};

let snapshot: AgendaSnapshot = INITIAL;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

// Mount tetikli yükleme bu kadar tazeyse tekrar istek atılmaz.
//
// ⚠️ Bilerek KISA. Uzun bir pencere (30 sn denendi) modül geçişlerinde
// hiç istek atmıyordu — kulağa iyi geliyor ama yanlış: Ödeme'de tahsilatı
// yapıp ERP'ye dönen müdür Gündem'de o taksiti hâlâ "vadesi geçti" olarak
// görürdü. Bu pencerenin işi tazelik değil, AYNI ANDA mount olan dört
// tüketicinin (Gündem paneli, iki menü, modül değiştirici) tek istekte
// birleşmesi — onu zaten `inflight` yapıyor, bu sadece geçiş anındaki
// çakışmayı topluyor.
const FRESH_MS = 5_000;

function computeModuleWork(items: AgendaItem[] | null): Record<ModuleId, ModuleWork> {
  const work: Record<ModuleId, ModuleWork> = Object.fromEntries(
    MODULES.map((m) => [m.id, { count: 0, critical: 0 }])
  ) as Record<ModuleId, ModuleWork>;
  if (!items) return work;
  for (const item of items) {
    // İşin gideceği yer modülünü de belirtir (bkz. moduleFromHref).
    // "Eksikler" sayılmaz: modül rozetinin anlamı "burada BEKLEYEN İŞ var",
    // süreklilik arz eden boşluk değil.
    if (item.horizon === "gaps") continue;
    const id = moduleFromHref(item.href);
    work[id].count += 1;
    if (item.urgency === "critical") work[id].critical += 1;
  }
  return work;
}

function publish(next: Partial<AgendaSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

export function loadAgenda(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && snapshot.loadedAt > 0 && Date.now() - snapshot.loadedAt < FRESH_MS) return Promise.resolve();

  publish({ loading: true });
  inflight = (async () => {
    let data: Agenda | null = null;
    try {
      const res = await fetch("/api/admin/agenda");
      if (res.ok) data = (await res.json()) as Agenda;
    } catch {
      data = null;
    }
    publish({
      items: data?.items ?? null,
      counts: data?.counts ?? EMPTY_COUNTS,
      badges: toBadges(data?.items ?? null),
      moduleWork: computeModuleWork(data?.items ?? null),
      loading: false,
      loadedAt: Date.now(),
    });
    inflight = null;
  })();
  return inflight;
}

/**
 * @param enabled Yalnızca yöneticide çekilir; öğretmen/veli ekranlarında uç
 *   nokta 403 döner, boşuna istek atılmasın.
 */
export function useAgenda(enabled = true) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL);

  useEffect(() => {
    if (!enabled) return;
    void loadAgenda();
  }, [enabled]);

  // Sekmeye/modüle gidip işi yapan müdür geri döndüğünde güncel sayıyı
  // görsün. FRESH_MS penceresi burada da geçerli — pencereye her
  // odaklanmada 23 sayım sorgusu koşmaz.
  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => void loadAgenda();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [enabled]);

  return { ...state, reload: () => void loadAgenda(true) };
}
