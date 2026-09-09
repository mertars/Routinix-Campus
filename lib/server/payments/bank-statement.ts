import { createHash } from "node:crypto";

// Banka ekstresi ayrıştırma.
//
// Türkiye'de her bankanın ekstre dışa aktarımı farklı: sütun adları,
// sıraları, tarih ve tutar biçimleri değişiyor. Tek bir bankaya göre
// yazılmış bir ayrıştırıcı diğerlerinde işe yaramaz; bu yüzden sütunlar
// ADLARINDAN tanınır ve yaygın Türkçe başlıklar eş anlamlılarıyla
// birlikte aranır.
//
// Ayrıştırıcı UYDURMAZ: tanıyamadığı satırı atlar ve sebebini döner.
// Yanlış okunmuş bir tutar, okunamamış bir satırdan çok daha kötüdür.

export type ParsedBankRow = {
  lineNumber: number;
  transactionDate: Date;
  amount: number;
  description: string;
  bankReference: string | null;
};

export type ParseResult = {
  rows: ParsedBankRow[];
  skipped: { lineNumber: number; reason: string }[];
  detectedColumns: Record<string, string>;
};

// Sütun adı eş anlamlıları. Küçük harfe ve boşluksuz hale getirilerek
// karşılaştırılır.
const COLUMN_ALIASES: Record<string, string[]> = {
  date: ["tarih", "işlemtarihi", "islemtarihi", "valörtarihi", "valortarihi", "date", "transactiondate"],
  amount: ["tutar", "işlemtutarı", "islemtutari", "alacak", "amount", "credit"],
  description: ["açıklama", "aciklama", "işlemaçıklaması", "islemaciklamasi", "description", "detay"],
  reference: ["referans", "referansno", "dekontno", "işlemno", "islemno", "reference"],
};

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/\s+/g, "")
    .replace(/[^a-zçğıöşü]/g, "");
}

// Türkçe biçimli tutar: "1.234,56" → 1234.56. İngilizce biçim
// ("1,234.56") de kabul edilir; ayrım son ayıraca göre yapılır.
export function parseTurkishAmount(raw: string): number | null {
  const text = raw.replace(/[^\d.,-]/g, "").trim();
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized: string;

  if (lastComma > lastDot) {
    // Virgül ondalık ayıracı: binlik noktaları at.
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = text.replace(/,/g, "");
  } else {
    normalized = text;
  }

  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// "12.09.2026", "2026-09-12", "12/09/2026" — hepsi UTC gün başına
// indirgenir. Saat bilgisi varsa atılır: ekstre satırı bir GÜNÜ
// temsil eder ve saat dilimi kaymasına yer bırakılmamalı (bkz.
// lib/attendance/date-key.ts'teki aynı ders).
export function parseBankDate(raw: string): Date | null {
  const text = raw.trim().split(/[ T]/)[0];
  if (!text) return null;

  let y: number, m: number, d: number;
  const dotted = text.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (dotted) {
    d = Number(dotted[1]);
    m = Number(dotted[2]);
    y = Number(dotted[3]);
  } else if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    return null;
  }

  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function splitLine(line: string, delimiter: string): string[] {
  // Basit CSV: tırnak içindeki ayıraçlar korunur.
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  out.push(current);
  return out.map((c) => c.trim());
}

function detectDelimiter(headerLine: string): string {
  // Türkçe Excel noktalı virgül üretir; sekme ve virgül de yaygın.
  const counts: [string, number][] = [
    [";", (headerLine.match(/;/g) ?? []).length],
    ["\t", (headerLine.match(/\t/g) ?? []).length],
    [",", (headerLine.match(/,/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ";";
}

export function parseBankStatement(rawText: string): ParseResult {
  const lines = rawText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], skipped: [{ lineNumber: 1, reason: "Dosyada başlık satırı ve en az bir işlem olmalı." }], detectedColumns: {} };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map(normalizeHeader);

  const indexOf: Record<string, number> = {};
  const detectedColumns: Record<string, string> = {};
  const rawHeaders = splitLine(lines[0], delimiter);
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    if (idx >= 0) {
      indexOf[key] = idx;
      detectedColumns[key] = rawHeaders[idx];
    }
  }

  const rows: ParsedBankRow[] = [];
  const skipped: { lineNumber: number; reason: string }[] = [];

  if (indexOf.date === undefined || indexOf.amount === undefined) {
    return {
      rows: [],
      skipped: [
        {
          lineNumber: 1,
          reason:
            "Tarih ve Tutar sütunları bulunamadı. Beklenen başlıklardan biri olmalı: " +
            `Tarih/İşlem Tarihi ve Tutar/İşlem Tutarı. Dosyadaki başlıklar: ${rawHeaders.join(", ")}`,
        },
      ],
      detectedColumns,
    };
  }

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delimiter);
    const lineNumber = i + 1;

    const date = parseBankDate(cells[indexOf.date] ?? "");
    if (!date) {
      skipped.push({ lineNumber, reason: `Tarih okunamadı: "${cells[indexOf.date] ?? ""}"` });
      continue;
    }

    const amount = parseTurkishAmount(cells[indexOf.amount] ?? "");
    if (amount === null) {
      skipped.push({ lineNumber, reason: `Tutar okunamadı: "${cells[indexOf.amount] ?? ""}"` });
      continue;
    }
    // Negatif satırlar kurumun ÖDEMELERİdir (gider, masraf), tahsilat
    // değil. Bunları tahsilat gibi sunmak, sekreterin yanlışlıkla
    // öğrenciye para yazmasına yol açar.
    if (amount <= 0) {
      skipped.push({ lineNumber, reason: `Tutar tahsilat değil (${amount}) — çıkış hareketi atlandı.` });
      continue;
    }

    rows.push({
      lineNumber,
      transactionDate: date,
      amount,
      description: (indexOf.description !== undefined ? cells[indexOf.description] : "") ?? "",
      bankReference: (indexOf.reference !== undefined ? cells[indexOf.reference] : "") || null,
    });
  }

  return { rows, skipped, detectedColumns };
}

// Satırın kendisinden türetilen imza.
//
// Aynı ekstrenin iki kez yüklenmesi para birikmesine yol açmamalı.
// Banka referansı varsa o tek başına yeterlidir; yoksa satırın
// içeriğinden bir özet alınır.
export function fingerprintRow(accountId: string, row: ParsedBankRow): string {
  // ⚠️ Küçültme TÜRKÇE KURALLA YAPILMAZ.
  //
  // toLocaleLowerCase("tr") büyük "I" harfini "ı"ya çevirir; aynı
  // açıklamanın büyük ve küçük hali FARKLI imza üretirdi ("EGITIM" →
  // "egıtım" ama "egitim" → "egitim"). Bankalar açıklamayı bazen büyük
  // harfle gönderir; imza aynı satırı iki kez saymamak için var,
  // dilbilimsel doğruluk için değil. Değişmez (invariant) küçültme
  // hem belirli hem simetriktir.
  const basis = row.bankReference
    ? `${accountId}|ref:${row.bankReference}`
    : `${accountId}|${row.transactionDate.toISOString().slice(0, 10)}|${row.amount.toFixed(2)}|${row.description.trim().toLowerCase()}`;
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}
