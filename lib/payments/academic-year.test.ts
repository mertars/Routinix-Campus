import { describe, it, expect } from "vitest";
import { academicYearOf, academicYearOptions } from "./academic-year";

describe("academicYearOf", () => {
  // Öğretim yılı Eylül'de başlar; Ocak–Ağustos hâlâ ÖNCEKİ yılın dönemi.
  it("Eylül ve sonrası yeni dönemi başlatır", () => {
    expect(academicYearOf(new Date(2026, 8, 1))).toBe("2026-2027"); // 1 Eylül
    expect(academicYearOf(new Date(2026, 11, 31))).toBe("2026-2027");
  });

  it("Ocak–Ağustos önceki dönemde kalır", () => {
    expect(academicYearOf(new Date(2026, 0, 1))).toBe("2025-2026");
    expect(academicYearOf(new Date(2026, 7, 31))).toBe("2025-2026"); // 31 Ağustos
  });

  // Sınır günü: 31 Ağustos ile 1 Eylül farklı dönemlere düşmeli.
  it("Ağustos/Eylül sınırında dönem değişir", () => {
    expect(academicYearOf(new Date(2027, 7, 31))).toBe("2026-2027");
    expect(academicYearOf(new Date(2027, 8, 1))).toBe("2027-2028");
  });
});

describe("academicYearOptions", () => {
  it("önceki, içinde bulunulan ve sonraki dönemi verir", () => {
    expect(academicYearOptions(new Date(2026, 8, 15))).toEqual(["2025-2026", "2026-2027", "2027-2028"]);
  });

  it("içinde bulunulan dönem her zaman ortadadır", () => {
    const opts = academicYearOptions(new Date(2026, 2, 1));
    expect(opts[1]).toBe(academicYearOf(new Date(2026, 2, 1)));
  });
});
