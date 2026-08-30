import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

// Noto Sans (latin-ext altkümesi) — react-pdf'in varsayılan Standart 14
// fontları (Helvetica vb.) Türkçe karakterlerin çoğunu (ğ, ş, ç, ö, ü ve
// büyük halleri) İÇERMEZ; WinAnsiEncoding (cp1252) bu harfleri tanımaz.
//
// ⚠️ Bu dosyalar ARTIK saf @fontsource/noto-sans DEĞİL — Akademik Röntgen'in
// köklü/matematik ifadeleri PDF'te tamamen SESSİZCE KAYBOLUYORDU (react-pdf
// eksik glif için hata VERMİYOR, karakteri atlıyor) çünkü latin-ext
// altkümesinde Matematiksel İşleçler Unicode bloğu (U+2200-22FF) yok.
// react-pdf `fontFamily` için TEK bir string kabul ediyor (dizi/fallback
// zinciri DESTEKLEMİYOR, bkz. @react-pdf/font FontFamily.resolve), bu
// yüzden iki ayrı font kaydedip ayrı ayrı kullanmak yerine `fonttools merge`
// ile @fontsource/noto-sans-math'ın gerekli glif seti (MATH tablosu
// çıkarılmış) BU dosyaların İÇİNE gömüldü — tek dosya, hem Türkçe hem
// matematik sembolü kapsıyor. Kapsanan semboller: √ ± × ÷ ≤ ≥ ≠ ≈ ∫ ∑ ∏ ∞
// π ° ′ ″ · Δ ∂ ∝ ∈ ∩ ∪ → (U+221A/00B1/00D7/00F7/2264/2265/2260/2248/222B/
// 2211/220F/221E/03C0/00B0/2032/2033/00B7/0394/2202/221D/2208/2229/222A/
// 2192). ∫ eksikliği bir kez ATLANDI (Akademik Röntgen'in "Test 1" içeriği
// bunu kullanınca fark edildi) — yeni bir matematik sembolü daha eksik
// çıkarsa AYNI yöntemle bu listeye eklenmeli. Yeniden üretmek gerekirse:
// iki font dosyasını fontTools.ttLib ile aç, MATH tablosunu sil,
// `python3 -m fontTools.merge` ile birleştir, `flavor="woff"` ile kaydet.
//
// ⚠️ Font.register'a DOSYA YOLU (public/fonts/...) vermek yerine BİLEREK
// base64 data URI'a çevrilip veriliyor: @react-pdf/font'un dosya-yolu dalı
// (isDataUrl/isUrl değilse fontkit.open(path) çağırıyor) Vercel'in serverless
// fonksiyon paketlemesinde (yerelde ÇALIŞIYORDU ama üretimde "PDF açılmıyor"
// şikayetine yol açtı) public/ altındaki dosyaları GÜVENİLİR ŞEKİLDE dahil
// etmiyor. fs.readFileSync burada, KENDİ modülümüzün en üst seviyesinde,
// SABİT bir yol literaliyle çağrılıyor — Next.js'in dosya izleyicisi (file
// tracing) bunu, üçüncü taraf bir paketin İÇİNDE gömülü dinamik bir yoldan
// çok daha güvenilir şekilde yakalar; üstüne üstlük data URI dalı hiç dosya
// G/Ç'si YAPMADAN, base64'ü doğrudan bellekte çözüyor — tracing'e bağımlılık
// TAMAMEN ortadan kalkıyor.
let registered = false;

export const PDF_FONT_FAMILY = "NotoSans";

function toDataUri(fileName: string): string {
  const filePath = path.join(process.cwd(), "public/fonts", fileName);
  const base64 = fs.readFileSync(filePath).toString("base64");
  return `data:font/woff;base64,${base64}`;
}

export function ensurePdfFontsRegistered(): void {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: toDataUri("NotoSans-Regular.woff") },
      { src: toDataUri("NotoSans-Bold.woff"), fontWeight: "bold" },
    ],
  });
  registered = true;
}
