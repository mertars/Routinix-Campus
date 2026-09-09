import { describe, it, expect } from "vitest";
import { checkHeaders } from "./headers";

describe("checkHeaders", () => {
  const gecerliOgrenci = {
    "T.C. No": "12345678901",
    "Ad Soyad": "Ayşe Yılmaz",
    "Öğrenci GSM": "05551112233",
    Şube: "9-A",
    "Veli Ad Soyad": "Mehmet Yılmaz",
    "Veli GSM": "05554445566",
  };

  it("doğru başlıklı dosyayı kabul eder", () => {
    expect(checkHeaders("STUDENT", [gecerliOgrenci]).ok).toBe(true);
  });

  it("isteğe bağlı sütunların yokluğu dosyayı reddetmez", () => {
    // "SMS İzni" ve "Özel Not" boş bırakılabilir.
    const r = checkHeaders("STUDENT", [gecerliOgrenci]);
    expect(r.missing).toEqual([]);
  });

  // Testte yaşanan durum: "GSM" yerine "Cep Telefonu" yazılmış bir dosya
  // her satır için ayrı ayrı "GSM zorunludur." hatası veriyordu.
  it("eksik sütunu SÜTUN sorunu olarak bildirir, satır hatası olarak değil", () => {
    const r = checkHeaders("TEACHER", [
      { "T.C. No": "1", "Ad Soyad": "Cem Yalçın", Branş: "Matematik", "Cep Telefonu": "05551112233" },
    ]);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain("GSM");
    expect(r.message).toContain("GSM");
  });

  it("tanınmayan sütunu da söyler — kullanıcı neyi yanlış yazdığını görsün", () => {
    const r = checkHeaders("TEACHER", [
      { "T.C. No": "1", "Ad Soyad": "Cem Yalçın", Branş: "Matematik", "Cep Telefonu": "05551112233" },
    ]);
    expect(r.message.toLocaleLowerCase("tr")).toContain("cep telefonu");
  });

  it("beklenen tüm başlıkları mesaja koyar — başka yere bakmak gerekmesin", () => {
    const r = checkHeaders("STUDENT", [{ "Ad Soyad": "Ayşe" }]);
    expect(r.message).toContain("T.C. No");
    expect(r.message).toContain("Veli GSM");
  });

  it("İngilizce alan adlarını da geçerli sayar (API'yi doğrudan kullananlar)", () => {
    const r = checkHeaders("STUDENT", [
      {
        nationalId: "12345678901",
        fullName: "Ayşe Yılmaz",
        phone: "05551112233",
        branchName: "9-A",
        parentName: "Mehmet Yılmaz",
        parentPhone: "05554445566",
      },
    ]);
    expect(r.ok).toBe(true);
  });

  it("büyük/küçük harf ve fazladan boşluk başlığı bozmaz", () => {
    const r = checkHeaders("BRANCH", [{ "  şube adı ": "9-A", "SINIF SEVİYESİ": "9", segment: "YKS" }]);
    expect(r.ok).toBe(true);
  });

  it("boş dosyada hata üretmez — o durumu çağıran taraf ele alır", () => {
    expect(checkHeaders("STUDENT", []).ok).toBe(true);
  });
});
