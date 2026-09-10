import { describe, it, expect } from "vitest";
import { trPossessive } from "./tr-suffix";

describe("trPossessive", () => {
  it("birler basamağı ekin sesini belirler", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(trPossessive)).toEqual([
      "1'i", "2'si", "3'ü", "4'ü", "5'i", "6'sı", "7'si", "8'i", "9'u",
    ]);
  });

  it("sıfırla biten sayılarda son sözcük onluktur", () => {
    expect([10, 20, 30, 40, 50, 60, 70, 80, 90].map(trPossessive)).toEqual([
      "10'u", "20'si", "30'u", "40'ı", "50'si", "60'ı", "70'i", "80'i", "90'ı",
    ]);
  });

  it("yüz, bin ve milyon kendi eklerini alır", () => {
    expect(trPossessive(100)).toBe("100'ü");
    expect(trPossessive(300)).toBe("300'ü");
    expect(trPossessive(1000)).toBe("1000'i");
    expect(trPossessive(1_000_000)).toBe("1000000'u");
  });

  it("çok basamaklı sayıda yalnızca son sözcük sayılır", () => {
    expect(trPossessive(1925)).toBe("1925'i"); // ...yirmi beşi
    expect(trPossessive(132)).toBe("132'si"); // yüz otuz ikisi
    expect(trPossessive(147)).toBe("147'si"); // yüz kırk yedisi
    expect(trPossessive(1200)).toBe("1200'ü"); // bin iki yüzü
  });

  it("sıfır ve negatif sayı patlamaz", () => {
    expect(trPossessive(0)).toBe("0'ı");
    expect(trPossessive(-5)).toBe("-5'i");
  });
});
