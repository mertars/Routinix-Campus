import { describe, it, expect } from "vitest";
import { computeRemaining, OPEN_INSTALLMENT_STATUSES } from "./student-debt";

// Bu kural EN AZ BEŞ ayrı yere elle yazılmıştı (günlük özet,
// yapılandırma ×2, nakit akışı, genel arama, kayıt yenileme). Hepsi
// buraya bağlandı; testler kuralın kendisini sabitliyor ki gelecekte
// biri değiştiğinde veliye ve müdüre farklı rakam gösterilmesin.
describe("computeRemaining", () => {
  it("ödeme yapılmamış taksit tamamen borçtur", () => {
    expect(computeRemaining([{ amount: 1000, payments: [] }])).toBe(1000);
  });

  it("kısmi ödeme düşülür", () => {
    expect(computeRemaining([{ amount: 1000, payments: [{ amount: 400 }] }])).toBe(600);
  });

  it("birden çok taksit ve ödeme toplanır", () => {
    expect(
      computeRemaining([
        { amount: 1000, payments: [{ amount: 400 }, { amount: 100 }] },
        { amount: 500, payments: [] },
      ])
    ).toBe(1000);
  });

  it("boş listede borç sıfırdır", () => {
    expect(computeRemaining([])).toBe(0);
  });

  // Prisma Decimal alanları string olarak da gelebilir; Number()
  // dönüşümü olmadan toplama string birleştirmesine dönerdi.
  it("Decimal alanları string geldiğinde de doğru toplar", () => {
    expect(computeRemaining([{ amount: "1000.50", payments: [{ amount: "0.50" }] }])).toBe(1000);
  });

  it("kuruş hataları birikmez", () => {
    const rows = Array.from({ length: 3 }, () => ({ amount: 33.33, payments: [{ amount: 11.11 }] }));
    expect(computeRemaining(rows)).toBe(66.66);
  });

  it("açık taksit durumları PENDING ve PARTIALLY_PAID", () => {
    // İPTAL edilmiş taksit borç değildir; ÖDENMİŞ taksit de değildir.
    expect([...OPEN_INSTALLMENT_STATUSES]).toEqual(["PENDING", "PARTIALLY_PAID"]);
    expect(OPEN_INSTALLMENT_STATUSES).not.toContain("CANCELLED");
    expect(OPEN_INSTALLMENT_STATUSES).not.toContain("PAID");
  });
});
