import { describe, it, expect } from "vitest";
import { toCsv, csvNumber, csvDate, CSV_BOM } from "./csv";

describe("csvNumber", () => {
  // Excel'in Türkçe yerelinde ondalık ayracı virgüldür; nokta kullanılırsa
  // "1234.56" binlik ayraçlı bir tam sayı gibi okunur.
  it("ondalık ayracı virgül yapar", () => {
    expect(csvNumber(1234.5)).toBe("1234,50");
    expect(csvNumber(0)).toBe("0,00");
  });

  // Binlik ayracı EKLENMEZ: "1.234,56" Excel'de metin olarak algılanır.
  it("binlik ayracı eklemez", () => {
    expect(csvNumber(1234567.89)).toBe("1234567,89");
  });

  it("negatif tutarı korur", () => {
    expect(csvNumber(-150)).toBe("-150,00");
  });
});

describe("toCsv", () => {
  it("BOM ile başlar ve noktalı virgülle ayırır", () => {
    const csv = toCsv(["A", "B"], [[1, "x"]]);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
    expect(csv).toContain('"A";"B"');
  });

  // Ayraç noktalı virgül olduğu için virgül içeren metin güvenlidir; asıl
  // tehlike ÇİFT TIRNAKTIR — kaçırılmazsa hücre erken kapanır.
  it("çift tırnağı ikileyerek kaçırır", () => {
    expect(toCsv(["A"], [['12" ekran']])).toContain('"12"" ekran"');
  });

  it("noktalı virgül içeren metni hücre içinde tutar", () => {
    const csv = toCsv(["A", "B"], [["x;y", "z"]]);
    expect(csv).toContain('"x;y";"z"');
  });

  it("null ve undefined için boş hücre yazar", () => {
    expect(toCsv(["A", "B"], [[null, undefined]])).toContain('"";""');
  });

  it("satırları CRLF ile ayırır", () => {
    const csv = toCsv(["A"], [["1"], ["2"]]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

describe("csvDate", () => {
  it("gün.ay.yıl biçiminde yazar", () => {
    expect(csvDate(new Date(2026, 8, 8))).toBe("08.09.2026");
  });

  it("null için boş döner", () => {
    expect(csvDate(null)).toBe("");
  });
});
