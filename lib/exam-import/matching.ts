import type { ColumnRole, GridRow, RosterStudent } from "./types";

function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr");
}

function normalizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Bir PDF satırını gerçek bir öğrenciyle eşleştirir — T.C./Öğrenci No tam
// eşleşme ÖNCELİKLİdir (birebir, yanlış eşleşme riski yok); yoksa Ad Soyad
// tam eşleşmesine düşer. Aynı isimde birden fazla öğrenci varsa (gerçek
// bir olasılık) SESSİZCE ilkini seçmek YERİNE "ambiguous" işaretlenir —
// yanlış öğrenciye not yazılması, bu içe aktarma aracının önleyebileceği
// en ciddi hatadır.
export function matchRowToStudent(
  cells: string[],
  columnRoles: ColumnRole[],
  roster: RosterStudent[]
): { studentId: string | null; status: "matched" | "ambiguous" | "unmatched"; candidates: RosterStudent[] } {
  const nationalIdColIndex = columnRoles.findIndex((r) => r.kind === "NATIONAL_ID");
  if (nationalIdColIndex >= 0) {
    const rawId = normalizeDigits(cells[nationalIdColIndex] ?? "");
    if (rawId) {
      const byId = roster.filter((s) => s.nationalId === rawId || s.studentNumber === (cells[nationalIdColIndex] ?? "").trim());
      if (byId.length === 1) return { studentId: byId[0].id, status: "matched", candidates: byId };
      if (byId.length > 1) return { studentId: null, status: "ambiguous", candidates: byId };
    }
  }

  const nameColIndex = columnRoles.findIndex((r) => r.kind === "NAME");
  const branchColIndex = columnRoles.findIndex((r) => r.kind === "BRANCH");
  if (nameColIndex >= 0) {
    const rawName = normalizeName(cells[nameColIndex] ?? "");
    if (rawName) {
      let candidates = roster.filter((s) => normalizeName(`${s.firstName} ${s.lastName}`) === rawName);
      if (candidates.length > 1 && branchColIndex >= 0) {
        const rawBranch = normalizeName(cells[branchColIndex] ?? "");
        if (rawBranch) {
          const narrowed = candidates.filter((s) => normalizeName(s.branchName) === rawBranch);
          if (narrowed.length > 0) candidates = narrowed;
        }
      }
      if (candidates.length === 1) return { studentId: candidates[0].id, status: "matched", candidates };
      if (candidates.length > 1) return { studentId: null, status: "ambiguous", candidates };
    }
  }

  return { studentId: null, status: "unmatched", candidates: [] };
}

export function matchAllRows(rows: GridRow[], columnRoles: ColumnRole[], roster: RosterStudent[]): GridRow[] {
  return rows.map((row) => {
    if (row.matchStatus === "skipped") return row;
    const result = matchRowToStudent(row.cells, columnRoles, roster);
    return { ...row, matchedStudentId: result.studentId, matchStatus: result.status, ambiguousCandidates: result.candidates };
  });
}
