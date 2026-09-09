import { describe, it, expect } from "vitest";
import { matchBankRow, normalizeForMatch, type MatchableStudent } from "./bank-match";

const ogrenci = (over: Partial<MatchableStudent> = {}): MatchableStudent => ({
  id: "s1",
  firstName: "Ahmet",
  lastName: "Kaya",
  studentNumber: "2026-1042",
  branchName: "9-A",
  openDebt: 12000,
  parentNames: ["Mehmet Kaya"],
  ...over,
});

describe("normalizeForMatch", () => {
  it("Türkçe harfleri ve büyük/küçük farkını eşitler", () => {
    expect(normalizeForMatch("İSMAİL ÖZTÜRK")).toBe("ismail ozturk");
    expect(normalizeForMatch("ismail öztürk")).toBe("ismail ozturk");
  });

  it("noktalama ve fazla boşluğu temizler", () => {
    expect(normalizeForMatch("HAVALE  -  AHMET/KAYA")).toBe("havale ahmet kaya");
  });
});

describe("matchBankRow", () => {
  it("açıklamada öğrenci numarası varsa güçlü öneri yapar", () => {
    const r = matchBankRow([ogrenci()], "EGITIM UCRETI 2026-1042", 12000);
    expect(r.suggestedStudentId).toBe("s1");
    expect(r.candidates[0].reasons.join(" ")).toContain("öğrenci no");
  });

  it("ad soyad tam geçiyorsa öneri yapar", () => {
    const r = matchBankRow([ogrenci()], "AHMET KAYA HAVALE", 12000);
    expect(r.suggestedStudentId).toBe("s1");
  });

  it("veli adı da sinyaldir — havaleyi çoğu zaman veli yapar", () => {
    const r = matchBankRow([ogrenci()], "MEHMET KAYA TARAFINDAN GONDERILDI", 5000);
    expect(r.candidates[0].reasons.join(" ")).toContain("veli adı");
  });

  // Tek başına ilk isim çok yaygın: "AHMET" yüzlerce öğrenciye uyar.
  it("yalnızca ilk isim eşleşmesi ÖNERİYE yetmez", () => {
    const r = matchBankRow([ogrenci()], "AHMET ODEME", 12000);
    expect(r.suggestedStudentId).toBeNull();
  });

  // ⚠️ Yanlış öğrenciye para yazmak, hiç yazmamaktan pahalıdır.
  it("iki öğrenci AYNI puanı alıyorsa öneri yapmaz, ikisini de listeler", () => {
    const ikiz = [
      ogrenci({ id: "a", studentNumber: "2026-0001", parentNames: [] }),
      ogrenci({ id: "b", studentNumber: "2026-0002", parentNames: [] }),
    ];
    const r = matchBankRow(ikiz, "AHMET KAYA", 12000);
    expect(r.suggestedStudentId).toBeNull();
    expect(r.candidates).toHaveLength(2);
  });

  it("tutar tek başına eşleştirme sebebi DEĞİLDİR", () => {
    // Aynı taksiti yüz öğrenci ödüyor olabilir; isim/numara sinyali
    // yoksa tutarın tutması bir şey ifade etmez.
    const r = matchBankRow([ogrenci()], "HAVALE", 12000);
    expect(r.candidates).toHaveLength(0);
    expect(r.suggestedStudentId).toBeNull();
  });

  it("tutar borcun tamamına eşitse güveni ARTIRIR ama tek başına yetmez", () => {
    const isimli = matchBankRow([ogrenci()], "AHMET KAYA", 12000);
    const isimliFarkliTutar = matchBankRow([ogrenci()], "AHMET KAYA", 999);
    expect(isimli.candidates[0].score).toBeGreaterThan(isimliFarkliTutar.candidates[0].score);
  });

  it("hiçbir sinyal yoksa aday üretmez", () => {
    const r = matchBankRow([ogrenci()], "FAST ODEME 998877", 12000);
    expect(r.candidates).toHaveLength(0);
  });

  it("Türkçe karakterli isimleri eşleştirir", () => {
    const s = ogrenci({ firstName: "İsmail", lastName: "Öztürk", parentNames: [] });
    const r = matchBankRow([s], "ISMAIL OZTURK EGITIM", 12000);
    expect(r.suggestedStudentId).toBe("s1");
  });

  // Öğrenci numarası kısa bir sayı dizisi; açıklamadaki rastgele bir
  // sayının içinde geçmesi eşleşme sayılmamalı.
  it("öğrenci numarası kelime sınırıyla aranır", () => {
    const s = ogrenci({ studentNumber: "1042", parentNames: [] });
    const r = matchBankRow([s], "DEKONT 9910421 ODEME", 12000);
    expect(r.candidates).toHaveLength(0);
  });

  it("en fazla 5 aday döner — liste kararı zorlaştırmasın", () => {
    const cok = Array.from({ length: 12 }, (_, i) =>
      ogrenci({ id: `s${i}`, studentNumber: `2026-10${i}`, parentNames: [] })
    );
    const r = matchBankRow(cok, "AHMET KAYA", 12000);
    expect(r.candidates.length).toBeLessThanOrEqual(5);
  });
});
