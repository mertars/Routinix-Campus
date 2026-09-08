import { describe, it, expect } from "vitest";
import { splitIntoInstallments } from "./installment-math";

describe("splitIntoInstallments", () => {
  it("tam bölünen tutarı eşit paylara ayırır", () => {
    expect(splitIntoInstallments(12000, 12)).toEqual(Array(12).fill(1000));
  });

  // ASIL KURAL: taksitlerin toplamı bölünen tutara BİREBİR eşit olmalı.
  // Aksi halde kuruşlar kaybolur, borç asla tam kapanmaz ve "kalan 0,04 ₺"
  // gibi hayalet bakiyeler oluşur.
  it("bölünemeyen tutarlarda toplam korunur, küsurat son taksite biner", () => {
    const cases: [number, number][] = [
      [10000, 3],
      [76000, 7],
      [12345.67, 11],
      [999.99, 4],
      [100, 3],
    ];
    for (const [total, count] of cases) {
      const parts = splitIntoInstallments(total, count);
      const sum = Math.round(parts.reduce((s, v) => s + v, 0) * 100) / 100;
      expect(sum, `${total} / ${count}`).toBe(Math.round(total * 100) / 100);
      expect(parts).toHaveLength(count);
    }
  });

  it("küsurat SON taksite eklenir, diğerleri eşittir", () => {
    const parts = splitIntoInstallments(100, 3);
    expect(parts.slice(0, -1)).toEqual([33.33, 33.33]);
    expect(parts[parts.length - 1]).toBe(33.34);
  });

  it("tek taksitte tutarın tamamını verir", () => {
    expect(splitIntoInstallments(7600.5, 1)).toEqual([7600.5]);
  });

  it("her taksit pozitiftir (son taksit negatife düşmez)", () => {
    for (const count of [1, 2, 3, 7, 12, 36]) {
      const parts = splitIntoInstallments(1000, count);
      for (const p of parts) expect(p).toBeGreaterThan(0);
    }
  });

  it("geçersiz girdileri reddeder", () => {
    expect(() => splitIntoInstallments(0, 3)).toThrow();
    expect(() => splitIntoInstallments(-100, 3)).toThrow();
    expect(() => splitIntoInstallments(1000, 0)).toThrow();
    expect(() => splitIntoInstallments(1000, 2.5)).toThrow();
    expect(() => splitIntoInstallments(Number.NaN, 3)).toThrow();
  });
});
