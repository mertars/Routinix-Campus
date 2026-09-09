import { describe, it, expect } from "vitest";
import { parseBankStatement, parseTurkishAmount, parseBankDate, fingerprintRow } from "./bank-statement";

describe("parseTurkishAmount", () => {
  it("Türkçe biçimi okur (binlik nokta, ondalık virgül)", () => {
    expect(parseTurkishAmount("1.234,56")).toBe(1234.56);
    expect(parseTurkishAmount("12.000,00")).toBe(12000);
  });

  it("İngilizce biçimi de okur", () => {
    expect(parseTurkishAmount("1,234.56")).toBe(1234.56);
  });

  it("para birimi ve boşlukları yok sayar", () => {
    expect(parseTurkishAmount(" 1.500,00 TL ")).toBe(1500);
    expect(parseTurkishAmount("₺2.000,50")).toBe(2000.5);
  });

  it("ayıraçsız sayıyı olduğu gibi okur", () => {
    expect(parseTurkishAmount("500")).toBe(500);
  });

  it("okunamayanda null döner — sıfır DEĞİL", () => {
    // Sıfır dönmek, okunamamış bir tutarı "0 TL tahsilat" gibi
    // gösterirdi. Para hesabında sessiz sıfır tehlikelidir.
    expect(parseTurkishAmount("")).toBeNull();
    expect(parseTurkishAmount("abc")).toBeNull();
  });
});

describe("parseBankDate", () => {
  it("gg.aa.yyyy okur", () => {
    expect(parseBankDate("12.09.2026")?.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("yyyy-aa-gg okur", () => {
    expect(parseBankDate("2026-09-12")?.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("gg/aa/yyyy okur", () => {
    expect(parseBankDate("01/01/2026")?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("saat bilgisini atar ve UTC gün başına indirger", () => {
    // Saat dilimi kayması yoklama tarihlerinde 1.946 kaydı bozmuştu;
    // aynı hatayı burada tekrarlamamak için gün başına indiriliyor.
    expect(parseBankDate("12.09.2026 14:35")?.toISOString()).toBe("2026-09-12T00:00:00.000Z");
  });

  it("geçersiz ayda null döner", () => {
    expect(parseBankDate("12.13.2026")).toBeNull();
    expect(parseBankDate("saçma")).toBeNull();
  });
});

describe("parseBankStatement", () => {
  const csv = [
    "Tarih;Açıklama;Tutar;Referans No",
    "12.09.2026;AHMET KAYA 2026-1042 EGITIM UCRETI;12.000,00;REF001",
    "13.09.2026;HAVALE - MEHMET YILMAZ;1.500,50;REF002",
  ].join("\n");

  it("noktalı virgüllü Türkçe CSV'yi okur", () => {
    const r = parseBankStatement(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].amount).toBe(12000);
    expect(r.rows[0].bankReference).toBe("REF001");
  });

  it("virgül ve sekme ayıracını da tanır", () => {
    const tab = csv.replace(/;/g, "\t");
    expect(parseBankStatement(tab).rows).toHaveLength(2);
  });

  it("başlık adları farklı yazılsa da sütunu bulur", () => {
    const alt = ["İşlem Tarihi,İşlem Açıklaması,İşlem Tutarı", "12.09.2026,TEST,500"].join("\n");
    const r = parseBankStatement(alt);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].amount).toBe(500);
  });

  // Çıkış hareketleri kurumun giderleridir. Tahsilat listesinde
  // göstermek, sekreterin yanlışlıkla öğrenciye para yazmasına yol açar.
  it("negatif (çıkış) hareketleri tahsilat saymaz", () => {
    const withDebit = ["Tarih;Açıklama;Tutar", "12.09.2026;KIRA ODEMESI;-25.000,00"].join("\n");
    const r = parseBankStatement(withDebit);
    expect(r.rows).toHaveLength(0);
    expect(r.skipped[0].reason).toContain("çıkış hareketi");
  });

  it("okunamayan satırı ATLAR ve sebebini söyler", () => {
    const bad = ["Tarih;Açıklama;Tutar", "bozuk;TEST;500", "12.09.2026;TEST;abc"].join("\n");
    const r = parseBankStatement(bad);
    expect(r.rows).toHaveLength(0);
    expect(r.skipped).toHaveLength(2);
    expect(r.skipped[0].reason).toContain("Tarih okunamadı");
    expect(r.skipped[1].reason).toContain("Tutar okunamadı");
  });

  it("zorunlu sütun yoksa dosyanın tamamını reddeder ve başlıkları listeler", () => {
    const r = parseBankStatement(["Ad;Soyad", "a;b"].join("\n"));
    expect(r.rows).toHaveLength(0);
    expect(r.skipped[0].reason).toContain("Tarih ve Tutar");
    expect(r.skipped[0].reason).toContain("Ad");
  });
});

describe("fingerprintRow — mükerrer yükleme koruması", () => {
  const row = {
    lineNumber: 2,
    transactionDate: new Date(Date.UTC(2026, 8, 12)),
    amount: 12000,
    description: "AHMET KAYA EGITIM",
    bankReference: null as string | null,
  };

  it("aynı satır aynı imzayı üretir", () => {
    expect(fingerprintRow("acc1", row)).toBe(fingerprintRow("acc1", row));
  });

  it("farklı hesapta farklı imza — iki hesaba aynı tutar gelebilir", () => {
    expect(fingerprintRow("acc1", row)).not.toBe(fingerprintRow("acc2", row));
  });

  it("tutar değişince imza değişir", () => {
    expect(fingerprintRow("acc1", row)).not.toBe(fingerprintRow("acc1", { ...row, amount: 12001 }));
  });

  it("banka referansı varsa imza ONA dayanır — açıklama değişse de aynı kalır", () => {
    const a = { ...row, bankReference: "REF001" };
    const b = { ...row, bankReference: "REF001", description: "BANKA ACIKLAMAYI DEGISTIRDI" };
    expect(fingerprintRow("acc1", a)).toBe(fingerprintRow("acc1", b));
  });

  it("açıklamada büyük/küçük harf farkı imzayı değiştirmez", () => {
    expect(fingerprintRow("acc1", row)).toBe(fingerprintRow("acc1", { ...row, description: "ahmet kaya egitim" }));
  });
});
