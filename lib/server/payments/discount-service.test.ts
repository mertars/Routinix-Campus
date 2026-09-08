import { describe, it, expect } from "vitest";
import { applyDiscounts } from "./discount-service";

const merit = (value: number) => ({ id: "m", type: "MERIT", valueType: "PERCENTAGE", value });
const sibling = (value: number) => ({ id: "s", type: "SIBLING", valueType: "FIXED", value });

describe("applyDiscounts", () => {
  it("indirim yoksa net liste fiyatına eşittir", () => {
    const r = applyDiscounts(100000, []);
    expect(r.netAmount).toBe(100000);
    expect(r.discountTotal).toBe(0);
  });

  it("tek yüzde indirimini uygular", () => {
    const r = applyDiscounts(100000, [merit(20)]);
    expect(r.discountTotal).toBe(20000);
    expect(r.netAmount).toBe(80000);
  });

  it("tek sabit indirimi uygular", () => {
    const r = applyDiscounts(100000, [sibling(5000)]);
    expect(r.discountTotal).toBe(5000);
    expect(r.netAmount).toBe(95000);
  });

  // KURAL: önce SABİT tutarlar düşülür, sonra KALAN üzerine yüzdeler
  // işlenir. Sıra sabit olmasaydı aynı indirim seti farklı net üretir ve
  // "neden bu rakam çıktı" açıklanamazdı.
  it("sabit indirimler yüzdelerden ÖNCE uygulanır (sıra garantisi)", () => {
    const r = applyDiscounts(100000, [merit(20), sibling(5000)]);
    // 100.000 − 5.000 = 95.000, sonra %20 → 19.000 indirim
    expect(r.discountTotal).toBe(24000);
    expect(r.netAmount).toBe(76000);
    const meritRow = r.rows.find((x) => x.type === "MERIT");
    expect(meritRow?.amount).toBe(19000);
  });

  it("indirimlerin GİRİŞ SIRASI sonucu değiştirmez", () => {
    const a = applyDiscounts(100000, [merit(20), sibling(5000)]);
    const b = applyDiscounts(100000, [sibling(5000), merit(20)]);
    expect(a.netAmount).toBe(b.netAmount);
    expect(a.discountTotal).toBe(b.discountTotal);
  });

  it("toplam indirim liste fiyatını AŞAMAZ, net negatife düşmez", () => {
    const r = applyDiscounts(10000, [sibling(50000)]);
    expect(r.netAmount).toBe(0);
    expect(r.discountTotal).toBe(10000);
    expect(r.rows[0].amount).toBe(10000); // 50.000 değil — kalanla sınırlı
  });

  it("%100 indirimde net sıfırdır", () => {
    const r = applyDiscounts(50000, [merit(100)]);
    expect(r.netAmount).toBe(0);
    expect(r.discountTotal).toBe(50000);
  });

  it("birden fazla yüzde ARDIŞIK uygulanır (kalan üzerinden)", () => {
    const r = applyDiscounts(
      100000,
      [
        { id: "a", type: "MERIT", valueType: "PERCENTAGE", value: 10 },
        { id: "b", type: "EARLY_REGISTRATION", valueType: "PERCENTAGE", value: 10 },
      ]
    );
    // %10 → 10.000, kalan 90.000 üzerinden %10 → 9.000 (toplam 19.000, %20 DEĞİL)
    expect(r.discountTotal).toBe(19000);
    expect(r.netAmount).toBe(81000);
  });

  it("satır tutarlarının toplamı discountTotal ile tutarlıdır", () => {
    const r = applyDiscounts(87500, [merit(15), sibling(3250)]);
    const rowSum = Math.round(r.rows.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    expect(rowSum).toBe(r.discountTotal);
    expect(Math.round((r.netAmount + r.discountTotal) * 100) / 100).toBe(87500);
  });

  it("negatif/sınır dışı yüzdeler güvenli şekilde kırpılır", () => {
    expect(applyDiscounts(1000, [{ id: "x", type: "OTHER", valueType: "PERCENTAGE", value: -50 }]).netAmount).toBe(1000);
    expect(applyDiscounts(1000, [{ id: "x", type: "OTHER", valueType: "PERCENTAGE", value: 150 }]).netAmount).toBe(0);
  });
});
