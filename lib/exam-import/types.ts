// Şu an desteklenen ders ölçütleri: bir vendor PDF'i bir dersi Doğru/Yanlış
// çift sütunla verebilir (net burada hesaplanır) VEYA doğrudan Net sütunuyla
// verebilir — format tutarlı olmadığından ikisi de desteklenir.
export type ColumnMetric = "DOGRU" | "YANLIS" | "NET";

export type ColumnRole =
  | { kind: "IGNORE" }
  | { kind: "NAME" }
  | { kind: "NATIONAL_ID" }
  | { kind: "BRANCH" }
  | { kind: "SUBJECT"; subject: string; metric: ColumnMetric };

// bkz. lib/server/admin/exam-net-results.ts > RosterStudentForMatching —
// kasıtlı olarak BURADA ayrı tanımlanır (server dosyasını client'a
// import ETMEYİZ, bkz. diğer client bileşenlerindeki aynı desen, örn.
// edit-user-modal.tsx > BranchOption).
export type RosterStudent = {
  id: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  studentNumber: string;
  branchId: string;
  branchName: string;
};

export type MatchStatus = "matched" | "ambiguous" | "unmatched" | "skipped";

export type GridRow = {
  id: string;
  cells: string[];
  matchedStudentId: string | null;
  matchStatus: MatchStatus;
  ambiguousCandidates: RosterStudent[];
};
