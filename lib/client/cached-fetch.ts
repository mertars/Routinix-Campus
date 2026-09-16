"use client";

import { useEffect, useRef, useState } from "react";

// İSTEK ÖNBELLEĞİ — "sekmeye her dönüşte 2 saniye bekleme".
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16: "bir sekmeye girdiğinde 2-3 saniye
// listelerin yüklenmesi sürüyor... bu tüm uygulamada var"). Ölçüldü:
// tek bir SQL gidiş-dönüşü ~90 ms (veritabanı Frankfurt'ta, işlevler
// varsayılan olarak ABD bölgesinde) ve Prisma bir listeyi 5 ayrı SQL'e
// bölüyor. Yani bir liste ekranı en iyi ihtimalle yarım saniye ağ demek.
// Bölge düzeltmesi bunu kökten çözüyor (bkz. vercel.json > regions) ama
// KULLANICI AÇISINDAN asıl kazanç, aynı veriyi ikinci kez beklememek.
//
// Davranış (stale-while-revalidate): önbellekte veri varsa ANINDA
// döndürülür ve arka planda tazelenir. Yani sekmeye geri dönmek anlıktır,
// veri de bayat kalmaz.
//
// ⚠️ Önbellek BELLEKTE ve sekme ömrü kadar yaşar — sayfa yenilenince
// silinir. Bilerek: oturum/kurum değişimiyle eski verinin sızması
// imkânsız olsun diye kalıcı bir depo (localStorage) KULLANILMIYOR.

type Entry = { data: unknown; at: number; inflight?: Promise<unknown> };

const cache = new Map<string, Entry>();

/** Bir isteği (ya da tüm önbelleği) geçersiz kılar — yazma sonrası çağrılır. */
export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
}

async function load<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

export type CachedFetchState<T> = {
  data: T | null;
  /** İlk yükleme (önbellekte hiçbir şey yokken) sürüyor mu? */
  loading: boolean;
  /** Arka planda tazeleme sürüyor mu? */
  revalidating: boolean;
  failed: boolean;
  refresh: () => void;
};

export function useCachedFetch<T>(
  url: string | null,
  options: { ttlMs?: number; enabled?: boolean } = {}
): CachedFetchState<T> {
  const ttl = options.ttlMs ?? 30_000;
  const enabled = options.enabled ?? true;
  const cached = url ? cache.get(url) : undefined;

  const [data, setData] = useState<T | null>((cached?.data as T | undefined) ?? null);
  const [loading, setLoading] = useState(!cached && !!url && enabled);
  const [revalidating, setRevalidating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url || !enabled) return;
    const entry = cache.get(url);
    const fresh = entry && Date.now() - entry.at < ttl;

    // Adres değiştiyse önce önbellekteki değeri göster — boş ekran yerine
    // bayat veri, bayat veri yerine iskelet.
    if (lastUrl.current !== url) {
      lastUrl.current = url;
      setData((entry?.data as T | undefined) ?? null);
      setLoading(!entry);
      setFailed(false);
    }

    if (fresh && tick === 0) {
      setLoading(false);
      return;
    }

    // ⚠️ İSTEK BİLEREK İPTAL EDİLMİYOR (AbortController YOK).
    //
    // İlk sürümde cleanup'ta abort ediliyordu ve bu, önbelleği tamamen
    // çalışmaz hale getiriyordu: React katı modda efekt çalışır → cleanup
    // iptal eder → efekt yeniden çalışır ve önbellekteki "uçuşta olan"
    // SÖZÜ yeniden kullanır; ama o söz zaten iptal edilmiş olduğu için
    // AbortError ile reddediliyor ve ekran boş kalıyordu (canlı ölçümle
    // görüldü: liste hiç yüklenmedi). Zaten paylaşılan bir isteği bir
    // tüketicinin iptal etmesi doğru da değil — cevap önbelleğe yazılsın,
    // sadece state güncellemesi bileşen hâlâ ekrandaysa yapılsın.
    let active = true;
    setRevalidating(true);
    // Aynı adrese aynı anda iki istek gitmesin (katı modda efekt iki kez
    // çalışır; üretimde de iki bileşen aynı veriyi isteyebilir).
    const promise = entry?.inflight ?? load<T>(url);
    if (!entry?.inflight) cache.set(url, { data: entry?.data ?? null, at: entry?.at ?? 0, inflight: promise });

    promise
      .then((result) => {
        cache.set(url, { data: result, at: Date.now() });
        if (!active) return;
        setData(result as T);
        setFailed(false);
      })
      .catch(() => {
        cache.delete(url);
        if (!active) return;
        setFailed(true);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setRevalidating(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, tick]);

  return {
    data,
    loading,
    revalidating,
    failed,
    refresh: () => {
      if (url) cache.delete(url);
      setTick((t) => t + 1);
    },
  };
}
