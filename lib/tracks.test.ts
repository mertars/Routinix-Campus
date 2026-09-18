import { describe, expect, it } from "vitest";
import {
  inferTrack,
  resolveTrack,
  responsibleSubjects,
  isResponsibleFor,
  TYT_SUBJECTS,
  AYT_SUBJECTS_BY_TRACK,
} from "./tracks";

// ⚠️ Bu testin asıl konusu Mert'in cümlesi: "bir sayısalcıyı edebiyattan
// değerlendiremeyiz." Kural bir kez bozulursa tüm değerlendirme ekranları
// sessizce yanlış olur, o yüzden burada kilitliyoruz.
describe("alan (track) çıkarımı", () => {
  it("şube adından alanı bulur", () => {
    expect(inferTrack("11-A Fen")).toBe("sayisal");
    expect(inferTrack("12-B Eşit Ağırlık")).toBe("esit_agirlik");
    expect(inferTrack("12-C Sözel")).toBe("sozel");
    expect(inferTrack("11-D Yabancı Dil")).toBe("dil");
  });

  it("alan yoksa null döner — uydurmaz", () => {
    expect(inferTrack("12-A VIP")).toBeNull();
    expect(inferTrack("YKS Mezun Sınıfı")).toBeNull();
    expect(inferTrack(null)).toBeNull();
  });

  it("YAZILI değer şube adından ÖNCE gelir", () => {
    expect(resolveTrack("Sözel", "11-A Fen")).toBe("sozel");
    expect(resolveTrack(null, "11-A Fen")).toBe("sayisal");
    expect(resolveTrack("sayisal", null)).toBe("sayisal");
  });
});

describe("sorumlu dersler", () => {
  it("ortaokulda alan kavramı yoktur", () => {
    const r = responsibleSubjects(7, null);
    expect(r.track).toBeNull();
    expect(r.trackMissing).toBe(false);
    expect(r.subjects).toContain("Fen Bilimleri");
    expect(r.subjects).not.toContain("Fizik");
  });

  it("9-10. sınıfta alan seçimi henüz yapılmamıştır", () => {
    const r = responsibleSubjects(9, null);
    expect(r.trackMissing).toBe(false);
    expect(r.trackOnly).toHaveLength(0);
    expect(r.subjects).toContain("Fizik");
  });

  it("SAYISAL öğrenci Edebiyat'tan SORUMLU DEĞİLDİR", () => {
    expect(isResponsibleFor(12, "sayisal", "Edebiyat")).toBe(false);
    expect(isResponsibleFor(12, "sayisal", "Fizik")).toBe(true);
  });

  it("SÖZEL öğrenci Fizik'ten AYT'de sorumlu değildir ama TYT'de sorumludur", () => {
    // TYT ortak olduğu için Fizik listede KALIR — ayrım AYT'de.
    expect(AYT_SUBJECTS_BY_TRACK.sozel).not.toContain("Fizik");
    expect([...TYT_SUBJECTS]).toContain("Fizik");
    expect(isResponsibleFor(12, "sozel", "Fizik")).toBe(true);
  });

  it("EA öğrencisi Biyoloji'den AYT'de sorumlu değildir", () => {
    expect(AYT_SUBJECTS_BY_TRACK.esit_agirlik).not.toContain("Biyoloji");
    expect(AYT_SUBJECTS_BY_TRACK.esit_agirlik).toContain("Edebiyat");
  });

  it("11+ ve alan bilinmiyorsa: sadece TYT ve EKSİK bayrağı", () => {
    const r = responsibleSubjects(12, null);
    expect(r.trackMissing).toBe(true);
    expect(r.trackOnly).toHaveLength(0);
    expect(r.subjects).toEqual([...TYT_SUBJECTS]);
  });

  it("TYT'de Türkçe, AYT'de Edebiyat vardır — karıştırılmaz", () => {
    expect([...TYT_SUBJECTS]).toContain("Türkçe");
    expect([...TYT_SUBJECTS]).not.toContain("Edebiyat");
    expect(AYT_SUBJECTS_BY_TRACK.sozel).toContain("Edebiyat");
    expect(AYT_SUBJECTS_BY_TRACK.sayisal).not.toContain("Türkçe");
  });
});

describe("Sadece TYT alanı (2 yıllık programlar)", () => {
  it("AYT dersi almaz, TYT'den sorumludur", () => {
    const r = responsibleSubjects(12, "tyt");
    expect(r.trackMissing).toBe(false);
    expect(r.trackOnly).toHaveLength(0);
    expect(r.subjects).toEqual([...TYT_SUBJECTS]);
    expect(isResponsibleFor(12, "tyt", "Geometri")).toBe(false);
    expect(isResponsibleFor(12, "tyt", "Matematik")).toBe(true);
  });

  it("şube adından TYT çıkarımı yapar", () => {
    expect(inferTrack("12-D Sadece TYT")).toBe("tyt");
    expect(inferTrack("2 Yıllık Hazırlık")).toBe("tyt");
  });
});
