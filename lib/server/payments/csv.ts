// Türkçe yerelde Excel uyumlu CSV.
//
// İki zorunluluk var ve ikisi de Excel'in Türkçe kurulumundan geliyor:
//   1) Ayraç NOKTALI VİRGÜL — virgül ondalık ayracıdır, alan ayracı
//      olarak kullanılırsa "1.234,56" iki hücreye bölünür.
//   2) Dosya başında BOM — olmadan Türkçe karakterler bozuk görünür.
export const CSV_BOM = "﻿";

function cell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return CSV_BOM + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
}

// Sayılar Excel'in Türkçe yerelinde doğru okunsun diye ondalık ayracı
// VİRGÜL olmalı. toLocaleString binlik ayracı da eklerdi ("1.234,56"),
// bu da Excel'de metin olarak algılanır — bu yüzden yalnızca nokta
// virgüle çevrilir.
export function csvNumber(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export function csvDate(d: Date | null): string {
  return d ? d.toLocaleDateString("tr-TR") : "";
}
