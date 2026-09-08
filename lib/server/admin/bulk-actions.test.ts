import { describe, it, expect } from "vitest";
import { resolvePromotionTarget, type BranchLike } from "./bulk-actions";

// Gerçek bir kurumun (12 şubeli) şube düzeni: 7-8 LGS, 9-10 harf ile,
// 11-12 ALAN ile ayrılıyor, bir de mezun grubu var.
const BRANCHES: BranchLike[] = [
  { id: "b7a", name: "7-A", grade: 7, segment: "LGS" },
  { id: "b8a", name: "8-A", grade: 8, segment: "LGS" },
  { id: "b9a", name: "9-A", grade: 9, segment: "YKS" },
  { id: "b9b", name: "9-B", grade: 9, segment: "YKS" },
  { id: "b10a", name: "10-A", grade: 10, segment: "YKS" },
  { id: "b10b", name: "10-B", grade: 10, segment: "YKS" },
  { id: "b11s", name: "11-Sayısal", grade: 11, segment: "YKS" },
  { id: "b11e", name: "11-Eşit Ağırlık", grade: 11, segment: "YKS" },
  { id: "b12s", name: "12-Sayısal", grade: 12, segment: "YKS" },
  { id: "b12e", name: "12-Eşit Ağırlık", grade: 12, segment: "YKS" },
  { id: "bmez", name: "Mezun-A", grade: 12, segment: "MEZUN" },
];

describe("resolvePromotionTarget", () => {
  it("aynı harfli bir üst şubeyi bulur", () => {
    const r = resolvePromotionTarget({ name: "9-A", grade: 9, segment: "YKS" }, BRANCHES);
    expect(r.toBranchId).toBe("b10a");
  });

  it("Türkçe karakterli alan adlarını eşleştirir", () => {
    const r = resolvePromotionTarget({ name: "11-Eşit Ağırlık", grade: 11, segment: "YKS" }, BRANCHES);
    expect(r.toBranchId).toBe("b12e");
  });

  it("LGS'den YKS'ye geçişi (8 → 9) engellemez", () => {
    const r = resolvePromotionTarget({ name: "8-A", grade: 8, segment: "LGS" }, BRANCHES);
    expect(r.toBranchId).toBe("b9a");
  });

  // 11'de öğrenciler alana ayrıldığı için 10-A'nın harf karşılığı yoktur.
  // Doğru davranış TAHMİN ETMEK DEĞİL, müdüre sormaktır.
  it("karşılığı belirsizse tahmin etmez, elle seçim ister", () => {
    const r = resolvePromotionTarget({ name: "10-A", grade: 10, segment: "YKS" }, BRANCHES);
    expect(r.toBranchId).toBeNull();
    expect(r.problem).toContain("elle seçin");
  });

  // 12'nin üstü "13. sınıf" değildir — bu, düzeltilen gerçek bir hataydı.
  it("12. sınıfı 13'e değil MEZUN grubuna yönlendirir", () => {
    const r = resolvePromotionTarget({ name: "12-Sayısal", grade: 12, segment: "YKS" }, BRANCHES);
    expect(r.toBranchId).toBe("bmez");
    expect(r.problem).toBeUndefined();
  });

  it("mezun şubesi yoksa '13. sınıf açın' demez, mezun etmeyi önerir", () => {
    const r = resolvePromotionTarget(
      { name: "12-Sayısal", grade: 12, segment: "YKS" },
      BRANCHES.filter((b) => b.segment !== "MEZUN")
    );
    expect(r.toBranchId).toBeNull();
    expect(r.problem).toContain("Mezun");
    expect(r.problem).not.toContain("13");
  });

  it("mezun grubunu bir yere taşımaz", () => {
    const r = resolvePromotionTarget({ name: "Mezun-A", grade: 12, segment: "MEZUN" }, BRANCHES);
    expect(r.toBranchId).toBeNull();
    expect(r.problem).toContain("bir üst sınıfa geçmez");
  });

  // Mezun şubesinin kademesi temsilîdir (12); 11 → 12 eşlemesinde
  // yanlışlıkla hedef olarak seçilmemeli.
  it("mezun şubesini normal atlatmada hedef olarak önermez", () => {
    const r = resolvePromotionTarget({ name: "11-Sözel", grade: 11, segment: "YKS" }, BRANCHES);
    expect(r.toBranchId).toBeNull();
    expect(r.problem).toContain("SÖZEL");
  });

  it("üst kademede hiç şube yoksa açılması gerektiğini söyler", () => {
    const r = resolvePromotionTarget({ name: "7-A", grade: 7, segment: "LGS" }, [BRANCHES[0]]);
    expect(r.problem).toContain("8. sınıf şubesi yok");
  });
});
