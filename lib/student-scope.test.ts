import { describe, it, expect } from "vitest";
import { resolveStudentLevel, trackFromGrade, DEMO_GRADE_CHOICES } from "./student-scope";

const grade12Demo = DEMO_GRADE_CHOICES.find((c) => c.key === "grade12")!;

// Bu testler, panelin öğrenciye YANLIŞ SEVİYE göstermesini engelliyor.
//
// Düzeltilen hata: seviye YALNIZCA localStorage'daki demo seçicisinden
// okunuyordu ve varsayılanı "grade12" idi. Seçiciye hiç dokunmayan bir
// 7. sınıf öğrencisi paneli 12. sınıf YKS adayı gibi görüyordu —
// üniversite tercih robotu, YKS geri sayımı ve röntgen kapısı hep
// yanlış seviyeye göre çalışıyordu. Ölçüldü: API grade 7 derken panel
// grade 12 kullanıyordu.
describe("resolveStudentLevel", () => {
  it("demo seçimi YOKKEN gerçek şube seviyesini kullanır", () => {
    expect(resolveStudentLevel(undefined, 7, "LGS")).toEqual({ grade: 7, segment: "LGS" });
  });

  it("7. sınıf öğrencisi YKS akışına düşmez", () => {
    const { grade } = resolveStudentLevel(undefined, 7, "LGS");
    expect(trackFromGrade(grade)).not.toBe("yks");
  });

  it("demo seçimi VARSA onu kullanır — önizleme aracı çalışmaya devam eder", () => {
    expect(resolveStudentLevel(grade12Demo, 7, "LGS")).toEqual({ grade: 12, segment: "YKS" });
  });

  // Mezun şubesinin sınıf seviyesi şemada temsilî olarak 12 tutulur;
  // mezun bir öğrenciyi "12. sınıf" saymak yanlış olur.
  it("MEZUN segmentinde temsilî sınıf seviyesi yok sayılır", () => {
    expect(resolveStudentLevel(undefined, 12, "MEZUN")).toEqual({ grade: undefined, segment: "MEZUN" });
  });

  it("mezun yine de YKS akışındadır", () => {
    const { grade } = resolveStudentLevel(undefined, 12, "MEZUN");
    expect(trackFromGrade(grade)).toBe("yks");
  });

  it("veri henüz yüklenmediyse çökmez", () => {
    const r = resolveStudentLevel(undefined, undefined, undefined);
    expect(r.grade).toBeUndefined();
    expect(r.segment).toBe("YKS");
  });
});

describe("trackFromGrade", () => {
  it("LGS yalnızca 8. sınıf", () => {
    expect(trackFromGrade(8)).toBe("lgs");
    expect(trackFromGrade(7)).toBe("genel");
  });

  it("YKS 11, 12 ve mezun", () => {
    expect(trackFromGrade(11)).toBe("yks");
    expect(trackFromGrade(12)).toBe("yks");
    expect(trackFromGrade(undefined)).toBe("yks");
  });

  it("ara sınıflar genel akademik", () => {
    expect(trackFromGrade(9)).toBe("genel");
    expect(trackFromGrade(10)).toBe("genel");
  });
});
