import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

// Noto Sans — react-pdf'in varsayılan Standart 14 fontları (Helvetica vb.)
// Türkçe karakterlerin çoğunu (ğ, ş, ç, ö, ü ve büyük halleri) İÇERMEZ;
// WinAnsiEncoding (cp1252) bu harfleri tanımaz.
//
// ⚠️ BU DOSYALAR SAF @fontsource/noto-sans DEĞİL, 3 AYRI Google Fonts
// alt-kümesinin ("latin" + "latin-ext" + "noto-sans-math"in bir parçası)
// `fonttools merge` ile TEK dosyada birleştirilmiş hali — react-pdf
// `fontFamily` için TEK bir string kabul ediyor (dizi/fallback zinciri
// DESTEKLEMİYOR, bkz. @react-pdf/font FontFamily.resolve), o yüzden fallback
// yerine gereken HER ŞEYİN TEK dosyada olması şart. GEÇMİŞTE İKİ AYRI CİDDİ
// HATA yapıldı, ikisi de "PDF görsel olarak doğru görünüyor ama..." tarzı
// SESSİZ hatalardı — bir dahaki font güncellemesinde AYNI hatalara
// düşülmemesi için ikisi de buraya not edildi:
//
// HATA 1 (giderildi): İlk halde SADECE Google'ın "latin-ext" alt-kümesi
// kullanılmıştı (bkz. eski yorum). "latin-ext" SADECE ğ/ş/Ğ/Ş/İ gibi
// Türkçe'ye özgü Latin Extended-A harflerini içerir — a-z/A-Z, rakamlar,
// noktalama, VE ö/ü/ç/ı gibi Latin-1 harfleri BUNUN DIŞINDA, Google'ın AYRI
// "latin" alt-kümesindedir (tarayıcılarda @font-face unicode-range ile iki
// dosya BİRLİKTE yüklenir — react-pdf'e TEK dosya verildiği için bu ayrım
// burada GEÇERSİZ). Font'ta a-z/ö/ü/ç/ı hiç YOKTU; react-pdf glif
// bulamayınca sessizce fontkit'in dahili fallback'ine (Helvetica/WinAnsi)
// düşüyordu — WinAnsi'de de 'ı' (dotless i, U+0131) YOK, bu yüzden PDF'lerde
// "l ve ı harfi karışıyor" şikayeti çıktı (ikisi de geçerli bir glif
// bulamayıp EN YAKIN/yanlış glife düşüyordu). Düzeltme: "latin" alt-kümesi
// TAMAMI + "latin-ext"ten SADECE ğĞşŞİ + math sembolleri birlikte merge
// edildi — artık a-z/A-Z/0-9/noktalama/ö/ü/ç/ı hepsi TEK fontun kendi
// glif setinde, fallback'e hiç düşülmüyor.
//
// HATA 2 (giderildi, ayrı bir oturumda): Akademik Röntgen'in köklü/
// matematik ifadeleri PDF'te tamamen SESSİZCE KAYBOLUYORDU (react-pdf
// eksik glif için hata VERMİYOR, karakteri atlıyor) çünkü o zamanki fontta
// Matematiksel İşleçler Unicode bloğu (U+2200-22FF) yoktu. Düzeltme:
// @fontsource/noto-sans-math'ın gerekli glif seti (MATH tablosu çıkarılmış)
// BU dosyaların İÇİNE gömüldü. İLK denemede noto-sans-math'ın TÜM (~3000
// glif) font'u merge edilmişti — bu, PDF'in ToUnicode (kopyala-yapıştır/
// metin-çıkarma) katmanını BOZDU (görsel olarak DOĞRU görünüyordu ama
// "İngilizce" kopyalanınca "İngiliz1e" çıkıyordu) — glif ID'leri kaydırılıp
// react-pdf'in ürettiği ToUnicode CMap'i yanlış eşleşti. Düzeltme: TÜM font
// yerine SADECE gereken küçük glif alt-kümesi (`pyftsubset`/Subsetter) merge
// edilerek çözüldü. Kapsanan semboller: √ ± × ÷ ≤ ≥ ≠ ≈ ∫ ∑ ∏ ∞ π ° ′ ″ · Δ
// ∂ ∝ ∈ ∩ ∪ → (U+221A/00B1/00D7/00F7/2264/2265/2260/2248/222B/2211/220F/
// 221E/03C0/00B0/2032/2033/00B7/0394/2202/221D/2208/2229/222A/2192).
//
// Yeni bir karakter/sembol eksik çıkarsa (ya da bu iki hatadan biri
// TEKRARLANIRSA — regresyon testi için bkz. `git log -- lib/server/pdf/
// fonts.ts` içindeki font yeniden üretme oturumları) AŞAĞIDAKİ üçlü
// subset+merge prosedürü İZLENMELİ, TEK dosyanın tamamını merge etmek
// DEĞİL:
//   1. `npm install --no-save @fontsource/noto-sans@5 @fontsource/noto-sans-math@5`
//   2. latin alt-kümesini OLDUĞU GİBİ (tamamı) subset'le:
//      `python3 -m fontTools.subset noto-sans-latin-{400,700}-normal.woff
//       --output-file=latin-{weight}.woff --unicodes="*" --glyph-names --layout-features='*'`
//   3. latin-ext'ten SADECE Türkçe'ye özgü fazlalığı subset'le (ğĞşŞİ):
//      `python3 -m fontTools.subset noto-sans-latin-ext-{400,700}-normal.woff
//       --output-file=ext-{weight}.woff --text="ğĞşŞİ" --glyph-names --layout-features='*'`
//   4. math'tan SADECE yukarıdaki sembol listesini subset'le, SONRA MATH
//      tablosunu SİL (fontTools.ttLib ile aç, `del font['MATH']`, kaydet) —
//      MATH tablosu fontTools.merge'de mergeMap hatasıyla PATLAR:
//      `python3 -m fontTools.subset noto-sans-math-latin-400-normal.woff
//       --output-file=math-{weight}.woff --text="√±×÷≤≥≠≈∫∑∏∞π°′″·Δ∂∝∈∩∪→" --glyph-names --layout-features='*'`
//   5. Üçünü BİRLİKTE merge et: `python3 -m fontTools.merge
//       --output-file=merged-{weight}.ttf latin-{weight}.woff ext-{weight}.woff math-{weight}.woff`
//   6. `flavor="woff"` ile kaydet, public/fonts/NotoSans-{Regular,Bold}.woff
//      üzerine yaz.
//   7. DOĞRULA — SADECE görsel değil, İKİSİ de: (a) gerçek bir react-pdf PDF
//      üret, `pypdf` ile metnini çıkar, girdiyle BİREBİR eşleştiğini kontrol
//      et (ToUnicode regresyonu için); (b) `pymupdf` ile sayfayı PNG'ye
//      render edip özellikle "l1I lI l1 Il" gibi bilinçli karıştırıcı bir
//      dizgiyi GÖZLE incele (glif karışması regresyonu için).
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
  // react-pdf, satır kaydırması için VARSAYILAN olarak İNGİLİZCE bir
  // heceleme (hyphenation) motoru çalıştırır — Türkçe kelimeleri İngilizce
  // heceleme örüntülerine göre bölmeye çalışması hiçbir zaman doğru
  // olmayacağı için (asıl "l/ı karışması" hatasının kök nedeni bu
  // DEĞİLDİ, bkz. turkish-text.ts'teki asıl teşhis) savunma amaçlı devre
  // dışı bırakılıyor: kelime OLDUĞU GİBİ tek parça döner, satır sonunda
  // heceleme YAPILMAZ, sadece boşluklardan bölünür.
  Font.registerHyphenationCallback((word) => [word]);
  registered = true;
}
