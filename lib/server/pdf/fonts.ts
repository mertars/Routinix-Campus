import fs from "fs";
import path from "path";
import { Font } from "@react-pdf/renderer";

// Noto Sans (latin-ext altkümesi) — react-pdf'in varsayılan Standart 14
// fontları (Helvetica vb.) Türkçe karakterlerin çoğunu (ğ, ş, ç, ö, ü ve
// büyük halleri) İÇERMEZ; WinAnsiEncoding (cp1252) bu harfleri tanımaz.
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
