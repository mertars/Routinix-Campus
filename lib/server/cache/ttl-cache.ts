// Çok ucuz, bellek-içi, TEK SÜREÇ varsayımlı bir TTL cache — InProcessQueue
// ve general-rate-limit.ts'teki AYNI desen (bkz. oralardaki notlar; yatay
// ölçeklenmiş bir dağıtımda Redis'e geçiş gerekir, arayüz sabit kalır).
//
// SADECE pahalı, sık okunan, "birkaç saniyelik gecikme kabul edilebilir"
// agregasyon uçları için (yönetici dashboard'u, öğretmen performans
// matrisi, risk radarı) — yazma-sonrası anlık geçersiz kılma YOKTUR,
// bilinçli olarak sade bir TTL kullanılır (bkz. FAZ 6 planı: "gerekirse").
// ⚠️ Cache anahtarı HER ZAMAN institutionId içermelidir — aksi halde bir
// kurumun agregasyonu başka bir kuruma sızabilir.
type Entry = { value: unknown; expiresAt: number };

const globalForCache = globalThis as unknown as { ttlCacheStore?: Map<string, Entry> };
const store = globalForCache.ttlCacheStore ?? new Map<string, Entry>();
if (process.env.NODE_ENV !== "production") {
  globalForCache.ttlCacheStore = store;
}

export function getCached<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// Bir fonksiyonu "hesapla, TTL boyunca önbellekten sun" desenine sarmalayan
// yardımcı — çağıran taraf sadece anahtarı ve hesaplama fonksiyonunu verir.
export async function withTtlCache<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== undefined) return cached;
  const value = await compute();
  setCached(key, value, ttlMs);
  return value;
}
