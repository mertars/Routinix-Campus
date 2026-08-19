import type { RawRow } from "./types";

// PDF'ler için genel amaçlı, güvenilir bir "tablo ayrıştırıcı" yoktur —
// burada metin konumlarına (x/y) dayalı, EN İYİ ÇABA (best-effort) bir
// sütun yeniden inşası yapılır. Düzgün hizalanmış, Excel/Word'den PDF'e
// aktarılmış basit tablolarda iyi çalışır; taranmış (görüntü) PDF'lerde
// veya karmaşık çok satırlı hücrelerde güvenilir değildir — bu yüzden
// sonraki Dry-Run adımı burada üretilen her satırı yeniden doğrular.
export async function parsePdfFile(file: File): Promise<RawRow[]> {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker dosyası webpack'in JS paketleme/minify hattından KASITLI olarak
  // dışarıda tutulur (public/pdf.worker.min.mjs, bkz. scripts/copy-pdf-worker.mjs) —
  // aksi halde Next.js build'i "import.meta paket dışında kullanılamaz" hatasıyla
  // başarısız olur (pdfjs-dist worker'ı kendi modül bağlamını bekler).
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  type TextItem = { x: number; y: number; text: string };
  const allItems: TextItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      allItems.push({ x: item.transform[4], y: item.transform[5], text: item.str.trim() });
    }
  }

  if (allItems.length === 0) return [];

  // Y konumuna göre satırlara grupla (aynı satırdaki metinler birbirine yakın y'de olur).
  const sorted = [...allItems].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  const Y_TOLERANCE = 4;
  for (const item of sorted) {
    const lastLine = lines[lines.length - 1];
    if (lastLine && Math.abs(lastLine[0].y - item.y) <= Y_TOLERANCE) {
      lastLine.push(item);
    } else {
      lines.push([item]);
    }
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);

  if (lines.length < 2) return [];

  // İlk satır = başlık satırı; başlıkların x konumları "sütun çapası" olur.
  const headerLine = lines[0];
  const headers = headerLine.map((h) => h.text);

  const rows: RawRow[] = [];
  for (const line of lines.slice(1)) {
    const row: RawRow = {};
    for (const item of line) {
      // En yakın başlık çapasını bul, o sütuna metni ekle.
      let closestIndex = 0;
      let closestDistance = Infinity;
      headerLine.forEach((header, index) => {
        const distance = Math.abs(header.x - item.x);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      const key = headers[closestIndex];
      row[key] = row[key] ? `${row[key]} ${item.text}` : item.text;
    }
    if (Object.values(row).some((v) => v?.trim())) rows.push(row);
  }

  return rows;
}
