import { describe, it, expect } from "vitest";
import { $Enums } from "@prisma/client";
import { BUILT_IN_TEMPLATES, builtInsFor, fillPlaceholders, missingPlaceholders } from "./catalog";

const enums = $Enums as unknown as Record<string, Record<string, string>>;
const valuesOf = (name: string) => Object.values(enums[name] ?? {});

// Hazır şablonlar kodda yazıldığı için hiçbir doğrulamadan geçmiyorlar:
// yanlış bir enum değeri ancak müdür şablonu UYGULAYIP kaydete bastığında
// ortaya çıkar. İlk yazımda üç değer gerçekten uydurmaydı
// (PARENT_MEETING/BEHAVIOR/CAREER — GuidanceCategory'de yoklar).
// Bu testler kataloğu şemanın kendisine karşı doğrular.
describe("hazır şablon kataloğu şemayla uyumlu", () => {
  it("duyuru kategorileri gerçek", () => {
    const valid = valuesOf("AnnouncementCategory");
    for (const t of builtInsFor("ANNOUNCEMENT")) {
      expect(valid, `${t.id} → ${t.payload.category}`).toContain(t.payload.category);
    }
  });

  it("duyuru kapsamları gerçek", () => {
    const valid = valuesOf("NotificationScopeType");
    for (const t of builtInsFor("ANNOUNCEMENT")) {
      expect(valid, t.id).toContain(t.payload.scopeType);
    }
  });

  it("rehberlik kategorileri ve gizlilik seviyeleri gerçek", () => {
    const cats = valuesOf("GuidanceCategory");
    const levels = valuesOf("ConfidentialityLevel");
    for (const t of builtInsFor("GUIDANCE_NOTE")) {
      expect(cats, `${t.id} → ${t.payload.category}`).toContain(t.payload.category);
      expect(levels, t.id).toContain(t.payload.confidentialityLevel);
    }
  });

  it("taksit sayıları makul (1-12)", () => {
    for (const t of builtInsFor("INSTALLMENT_PLAN")) {
      const n = t.payload.installmentCount as number;
      expect(Number.isInteger(n), t.id).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(12);
    }
  });

  it("kimlikler benzersiz ve 'hazir:' önekli", () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith("hazir:"), id).toBe(true);
  });

  it("her şablonun adı ve açıklaması var", () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.name.trim().length, t.id).toBeGreaterThan(0);
      expect(t.description.trim().length, t.id).toBeGreaterThan(0);
    }
  });
});

describe("yer tutucular", () => {
  it("verilen değerleri doldurur", () => {
    expect(fillPlaceholders("{{tarih}} günü {{kurum}}", { tarih: "12 Mayıs", kurum: "Zirve" })).toBe(
      "12 Mayıs günü Zirve"
    );
  });

  // Bilerek: karşılığı olmayan yer tutucu SİLİNMEZ. Sessizce boşalan bir
  // cümleyle duyuru yayınlamaktansa müdür "{{saat}}" görüp elle yazsın.
  it("karşılığı olmayanı silmez, olduğu gibi bırakır", () => {
    expect(fillPlaceholders("saat {{saat}}'da", {})).toBe("saat {{saat}}'da");
    expect(fillPlaceholders("saat {{saat}}", { saat: undefined })).toBe("saat {{saat}}");
  });

  it("doldurulmamışları listeler (tekrarsız)", () => {
    expect(missingPlaceholders("{{a}} ve {{b}} ve yine {{a}}")).toEqual(["a", "b"]);
  });
});
