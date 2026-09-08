import { describe, it, expect } from "vitest";
import { amountToTurkishWords } from "./receipt-service";

// Makbuzun "tutar yazıyla" alanı hukuken/teamülen belgenin bir parçasıdır;
// yanlış yazılmış bir tutar belgeyi tartışmalı hale getirir. Türkçenin
// kuralları burada İngilizceden ayrışır: "biryüz"/"birbin" DENMEZ ama
// "birmilyon" doğrudur.
describe("amountToTurkishWords", () => {
  it("birler ve onlar", () => {
    expect(amountToTurkishWords(1)).toBe("bir TL");
    expect(amountToTurkishWords(9)).toBe("dokuz TL");
    expect(amountToTurkishWords(10)).toBe("on TL");
    expect(amountToTurkishWords(11)).toBe("onbir TL");
    expect(amountToTurkishWords(90)).toBe("doksan TL");
  });

  it("yüzler — 'biryüz' DENMEZ, sadece 'yüz'", () => {
    expect(amountToTurkishWords(100)).toBe("yüz TL");
    expect(amountToTurkishWords(101)).toBe("yüzbir TL");
    expect(amountToTurkishWords(200)).toBe("ikiyüz TL");
    expect(amountToTurkishWords(999)).toBe("dokuzyüzdoksandokuz TL");
  });

  it("binler — 'birbin' DENMEZ, sadece 'bin'", () => {
    expect(amountToTurkishWords(1000)).toBe("bin TL");
    expect(amountToTurkishWords(1001)).toBe("binbir TL");
    expect(amountToTurkishWords(1500)).toBe("binbeşyüz TL");
    expect(amountToTurkishWords(2000)).toBe("ikibin TL");
    expect(amountToTurkishWords(76000)).toBe("yetmişaltıbin TL");
  });

  // 'bin'in aksine 'milyon' TEK BAŞINA kullanılmaz — "birmilyon" doğrudur.
  it("milyonlarda 'bir' KORUNUR", () => {
    expect(amountToTurkishWords(1000000)).toBe("birmilyon TL");
    expect(amountToTurkishWords(2000000)).toBe("ikimilyon TL");
  });

  it("kuruşları ayrı yazar", () => {
    expect(amountToTurkishWords(7600.5)).toBe("yedibinaltıyüz TL elli Kr");
    expect(amountToTurkishWords(0.05)).toBe("sıfır TL beş Kr");
    expect(amountToTurkishWords(123456.78)).toBe("yüzyirmiüçbindörtyüzellialtı TL yetmişsekiz Kr");
  });

  it("kuruş yoksa 'Kr' bölümünü hiç yazmaz", () => {
    expect(amountToTurkishWords(500)).toBe("beşyüz TL");
    expect(amountToTurkishWords(500.0)).toBe("beşyüz TL");
  });

  it("sıfır ve yuvarlama sınırları", () => {
    expect(amountToTurkishWords(0)).toBe("sıfır TL");
    // 0.005 -> kuruş 1'e yuvarlanır (bankacılık yuvarlaması değil, standart)
    expect(amountToTurkishWords(0.005)).toBe("sıfır TL bir Kr");
  });

  it("ara sıfır grupları atlanır (1.000.005 gibi)", () => {
    expect(amountToTurkishWords(1000005)).toBe("birmilyonbeş TL");
  });
});
