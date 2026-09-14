"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { NotificationDto, NotificationFeed } from "@/lib/notifications/events";

// BİLDİRİM DEPOSU — React ağacından bağımsız, modül seviyesinde tek kaynak.
//
// lib/agenda-store.ts ile AYNI desen ve AYNI gerekçe: zil beş farklı üst
// çubukta render ediliyor (yönetici, öğretmen, öğrenci, rehberlik, ödeme);
// her birini ayrı bir Provider'la sarmak hepsinin ayrı istek atması demekti.
// Depo modül seviyesinde durduğu için Next'in istemci taraflı gezinmesinde
// de ayakta kalıyor — modüller arası geçişte sayı anında doğru.

export type NotificationSnapshot = {
  items: NotificationDto[];
  unreadByCategory: Record<string, number>;
  unreadTotal: number;
  nextCursor: string | null;
  loading: boolean;
  /** Şu an hangi kategori sekmesi açık (null = Tümü). */
  category: string | null;
  loadedAt: number;
};

const INITIAL: NotificationSnapshot = {
  items: [],
  unreadByCategory: {},
  unreadTotal: 0,
  nextCursor: null,
  loading: false,
  category: null,
  loadedAt: 0,
};

let snapshot: NotificationSnapshot = INITIAL;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

// Aynı anda mount olan birden fazla tüketicinin (zil + panel) tek istekte
// birleşmesi için kısa tazelik penceresi — bkz. agenda-store'daki aynı not.
const FRESH_MS = 4_000;
// Arka planda sessiz yenileme: zil rozeti bayat kalmasın. 60 sn, agresif
// olmayan ama "yoklama girildi" gibi olayların makul sürede düşmesini
// sağlayan bir denge.
const POLL_MS = 60_000;

function publish(next: Partial<NotificationSnapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const l of listeners) l();
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

async function fetchFeed(category: string | null, cursor: string | null): Promise<NotificationFeed | null> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (cursor) params.set("cursor", cursor);
  try {
    const res = await fetch(`/api/inbox${params.toString() ? `?${params}` : ""}`);
    if (!res.ok) return null;
    return (await res.json()) as NotificationFeed;
  } catch {
    return null;
  }
}

export function loadInbox(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && snapshot.loadedAt > 0 && Date.now() - snapshot.loadedAt < FRESH_MS) return Promise.resolve();

  publish({ loading: true });
  inflight = (async () => {
    const data = await fetchFeed(snapshot.category, null);
    publish({
      items: data?.items ?? [],
      unreadByCategory: data?.unreadByCategory ?? {},
      unreadTotal: data?.unreadTotal ?? 0,
      nextCursor: data?.nextCursor ?? null,
      loading: false,
      loadedAt: Date.now(),
    });
    inflight = null;
  })();
  return inflight;
}

/** Sekme değiştirme — listeyi sıfırlayıp o kategoriyi çeker. */
export function setCategory(category: string | null): void {
  if (snapshot.category === category) return;
  publish({ category, items: [], nextCursor: null, loadedAt: 0 });
  void loadInbox(true);
}

/** "Daha eskiler" — mevcut listeye ekler, baştan çekmez. */
export async function loadMore(): Promise<void> {
  if (!snapshot.nextCursor || snapshot.loading) return;
  publish({ loading: true });
  const data = await fetchFeed(snapshot.category, snapshot.nextCursor);
  publish({
    items: [...snapshot.items, ...(data?.items ?? [])],
    nextCursor: data?.nextCursor ?? null,
    loading: false,
  });
}

/**
 * Okundu işaretleme — ekranı ANINDA günceller (iyimser), sonra sunucuya
 * yazar. Sunucu hata verirse sessizce sonraki yenilemede düzelir; bir
 * bildirimin okundu rozetinin geç düzelmesi, tıklamanın donmuş
 * hissettirmesinden daha küçük bir sorun.
 */
export async function markRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  const nextUnread = { ...snapshot.unreadByCategory };
  let removed = 0;
  for (const item of snapshot.items) {
    if (idSet.has(item.id) && !item.isRead) {
      nextUnread[item.category] = Math.max(0, (nextUnread[item.category] ?? 1) - 1);
      removed += 1;
    }
  }
  publish({
    items: snapshot.items.map((i) => (idSet.has(i.id) ? { ...i, isRead: true } : i)),
    unreadByCategory: nextUnread,
    unreadTotal: Math.max(0, snapshot.unreadTotal - removed),
  });

  try {
    await fetch("/api/inbox/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    // sessiz — sonraki yenilemede gerçek durum gelir
  }
}

/** Tümünü (ya da açık sekmedekileri) okundu işaretle. */
export async function markAllRead(category: string | null): Promise<void> {
  publish({
    items: snapshot.items.map((i) => (!category || i.category === category ? { ...i, isRead: true } : i)),
    unreadByCategory: category
      ? { ...snapshot.unreadByCategory, [category]: 0 }
      : {},
    unreadTotal: category ? Math.max(0, snapshot.unreadTotal - (snapshot.unreadByCategory[category] ?? 0)) : 0,
  });

  try {
    await fetch("/api/inbox/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true, ...(category ? { category } : {}) }),
    });
  } catch {
    // sessiz
  }
}

export function useNotifications(enabled = true) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => INITIAL);

  useEffect(() => {
    if (!enabled) return;
    void loadInbox();
  }, [enabled]);

  // Arka plan yenilemesi + sekmeye dönüşte tazeleme. Sekme arkadayken
  // istek atmamak için document.hidden kontrolü var — kullanıcı başka
  // sekmedeyken dakikada bir boşuna sorgu koşmasın.
  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void loadInbox(true);
    };
    const interval = setInterval(tick, POLL_MS);
    const onFocus = () => void loadInbox();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);

  return { ...state, reload: () => void loadInbox(true) };
}
