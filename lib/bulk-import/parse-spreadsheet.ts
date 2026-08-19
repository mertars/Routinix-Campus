import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { RawRow } from "./types";

export function parseXlsxFile(file: File): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: "" });
        resolve(rows.map((row) => normalizeRow(row)));
      } catch {
        reject(new Error("Excel dosyası okunamadı — dosyanın bozuk olmadığından emin olun."));
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı."));
    reader.readAsArrayBuffer(file);
  });
}

export function parseCsvFile(file: File): Promise<RawRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => resolve(results.data.map((row) => normalizeRow(row))),
      error: () => reject(new Error("CSV dosyası okunamadı.")),
    });
  });
}

// Sütun adlarındaki baş/son boşlukları temizler — Excel'den kopyala-yapıştır
// sonrası "T.C. No " gibi görünmez boşluk farklarının eşleşmeyi bozmasını önler.
function normalizeRow(row: RawRow): RawRow {
  const normalized: RawRow = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim()] = typeof value === "string" ? value.trim() : value;
  }
  return normalized;
}
