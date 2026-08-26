import { describe, it, expect, vi } from "vitest";
import { getCached, setCached, withTtlCache } from "./ttl-cache";

let counter = 0;
function uniqueKey() {
  counter += 1;
  return `test-cache-key-${counter}`;
}

describe("getCached / setCached", () => {
  it("hiç yazılmamış bir anahtar için undefined döner", () => {
    expect(getCached(uniqueKey())).toBeUndefined();
  });

  it("TTL süresi içinde yazılan değeri geri verir", () => {
    const key = uniqueKey();
    setCached(key, { hello: "world" }, 5_000);
    expect(getCached(key)).toEqual({ hello: "world" });
  });

  it("TTL süresi dolan bir değer için undefined döner (ve girişi temizler)", () => {
    vi.useFakeTimers();
    try {
      const key = uniqueKey();
      setCached(key, "deger", 1_000);
      expect(getCached(key)).toBe("deger");
      vi.advanceTimersByTime(1_001);
      expect(getCached(key)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withTtlCache", () => {
  it("ilk çağrıda compute() çalışır, ikinci çağrıda ÇALIŞMAZ (önbellekten döner)", async () => {
    const key = uniqueKey();
    const compute = vi.fn().mockResolvedValue("hesaplanan-deger");

    const first = await withTtlCache(key, 5_000, compute);
    const second = await withTtlCache(key, 5_000, compute);

    expect(first).toBe("hesaplanan-deger");
    expect(second).toBe("hesaplanan-deger");
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("TTL dolduktan sonra compute() TEKRAR çalışır (bayat veri süresiz kalmaz)", async () => {
    vi.useFakeTimers();
    try {
      const key = uniqueKey();
      const compute = vi.fn().mockResolvedValueOnce("ilk").mockResolvedValueOnce("ikinci");

      const first = await withTtlCache(key, 1_000, compute);
      vi.advanceTimersByTime(1_001);
      const second = await withTtlCache(key, 1_000, compute);

      expect(first).toBe("ilk");
      expect(second).toBe("ikinci");
      expect(compute).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // Kritik güvenlik davranışı: farklı kurumlara ait anahtarlar (bkz. FAZ 6
  // planı — cache anahtarı HER ZAMAN institutionId içermeli) birbirinden
  // tamamen bağımsız olmalı, aksi halde bir kurumun agregasyonu başka bir
  // kuruma sızabilir.
  it("farklı anahtarlar birbirinden tamamen izole çalışır", async () => {
    const keyA = uniqueKey();
    const keyB = uniqueKey();
    await withTtlCache(keyA, 5_000, async () => "kurum-A-verisi");
    await withTtlCache(keyB, 5_000, async () => "kurum-B-verisi");

    expect(getCached(keyA)).toBe("kurum-A-verisi");
    expect(getCached(keyB)).toBe("kurum-B-verisi");
  });
});
