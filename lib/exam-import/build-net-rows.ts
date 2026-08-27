import type { ColumnRole, GridRow } from "./types";

// bkz. lib/server/admin/exam-net-results.ts > NetResultRow — kasıtlı
// olarak burada ayrı tanımlanır (bkz. types.ts'teki aynı not).
export type NetResultRow = { studentId: string; subject: string; net: number };

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) ? value : null;
}

type SubjectColumn = { index: number; subject: string; metric: "DOGRU" | "YANLIS" | "NET" };

// Işaretlenmiş sütunlardan (bkz. ColumnRole) ve eşleşmiş satırlardan
// gerçek ExamNetResult satırlarını üretir. Aynı ders için hem Doğru+Yanlış
// (net = doğru - yanlış/4, bkz. app/api/exams/[id]/net-results/route.ts'teki
// AYNI formül) hem doğrudan Net sütunu desteklenir — biri varsa öteki
// yoksayılır, Net sütunu varsa o önceliklidir.
export function buildNetResultRows(rows: GridRow[], columnRoles: ColumnRole[]): { rows: NetResultRow[]; skippedRowCount: number } {
  const subjectColumns: SubjectColumn[] = [];
  columnRoles.forEach((role, index) => {
    if (role.kind === "SUBJECT" && role.subject.trim()) {
      subjectColumns.push({ index, subject: role.subject.trim(), metric: role.metric });
    }
  });
  const subjectNames = [...new Set(subjectColumns.map((c) => c.subject))];

  const output: NetResultRow[] = [];
  let skippedRowCount = 0;

  for (const row of rows) {
    if (row.matchStatus === "skipped" || !row.matchedStudentId) {
      skippedRowCount++;
      continue;
    }
    for (const subject of subjectNames) {
      const netCol = subjectColumns.find((c) => c.subject === subject && c.metric === "NET");
      if (netCol) {
        const net = parseNumber(row.cells[netCol.index]);
        if (net !== null) output.push({ studentId: row.matchedStudentId, subject, net: Math.round(net * 100) / 100 });
        continue;
      }
      const dogruCol = subjectColumns.find((c) => c.subject === subject && c.metric === "DOGRU");
      const yanlisCol = subjectColumns.find((c) => c.subject === subject && c.metric === "YANLIS");
      if (!dogruCol && !yanlisCol) continue;
      const dogru = (dogruCol ? parseNumber(row.cells[dogruCol.index]) : 0) ?? 0;
      const yanlis = (yanlisCol ? parseNumber(row.cells[yanlisCol.index]) : 0) ?? 0;
      const net = Math.round((dogru - yanlis / 4) * 100) / 100;
      output.push({ studentId: row.matchedStudentId, subject, net });
    }
  }

  return { rows: output, skippedRowCount };
}
