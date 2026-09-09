import { describe, it, expect } from "vitest";
import { $Enums } from "@prisma/client";
import { PARENT_VISIBLE_CONFIDENTIALITY } from "./visibility";

const ALL_LEVELS = Object.values(
  ($Enums as unknown as Record<string, Record<string, string>>).ConfidentialityLevel ?? {}
);

describe("veliye görünen rehberlik notları", () => {
  it("yalnızca PUBLIC görünür", () => {
    expect([...PARENT_VISIBLE_CONFIDENTIALITY]).toEqual(["PUBLIC"]);
  });

  it("gizli ve kuruma özel notlar veliye AÇILMAZ", () => {
    expect(PARENT_VISIBLE_CONFIDENTIALITY).not.toContain("CONFIDENTIAL");
    expect(PARENT_VISIBLE_CONFIDENTIALITY).not.toContain("RESTRICTED");
  });

  it("listedeki her değer şemada gerçekten var", () => {
    for (const level of PARENT_VISIBLE_CONFIDENTIALITY) {
      expect(ALL_LEVELS, `${level} ConfidentialityLevel'de yok`).toContain(level);
    }
  });

  // Asıl koruma bu: şemaya yeni bir seviye eklenirse test kırılır ve
  // ekleyen kişi "bu veliye görünmeli mi?" sorusunu YANITLAMAK zorunda
  // kalır. Negatif bir süzgeçte bu soru hiç sorulmazdı.
  it("şemaya yeni bir gizlilik seviyesi eklenirse bu test uyarır", () => {
    expect(
      ALL_LEVELS.sort(),
      "ConfidentialityLevel değişmiş. Yeni seviyenin veliye görünüp " +
        "görünmeyeceğine karar verip PARENT_VISIBLE_CONFIDENTIALITY'yi " +
        "ve bu testi güncelleyin."
    ).toEqual(["CONFIDENTIAL", "PUBLIC", "RESTRICTED"]);
  });
});
