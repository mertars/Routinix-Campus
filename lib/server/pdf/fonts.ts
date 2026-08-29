import { Font } from "@react-pdf/renderer";
import path from "path";

// Noto Sans (latin-ext altkümesi) — react-pdf'in varsayılan Standart 14
// fontları (Helvetica vb.) Türkçe karakterlerin çoğunu (ğ, ş, ç, ö, ü ve
// büyük halleri) İÇERMEZ; WinAnsiEncoding (cp1252) bu harfleri tanımaz.
// Dosyalar public/fonts altında YEREL olarak saklanır (render anında
// harici bir ağ isteği YAPILMAZ) — bkz. turkish-text.ts'teki "ı" kusuru
// notu, o hata bu fonttan bağımsız ama Noto Sans yine de en geniş glyph
// kapsamını sağladığı için tercih edildi.
let registered = false;

export const PDF_FONT_FAMILY = "NotoSans";

export function ensurePdfFontsRegistered(): void {
  if (registered) return;
  Font.register({
    family: PDF_FONT_FAMILY,
    fonts: [
      { src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.woff") },
      { src: path.join(process.cwd(), "public/fonts/NotoSans-Bold.woff"), fontWeight: "bold" },
    ],
  });
  registered = true;
}
