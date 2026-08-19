export type ImportRole = "STUDENT" | "TEACHER";

export type RawRow = Record<string, string | undefined>;

export type ValidatedRow = {
  rowIndex: number;
  raw: RawRow;
  fullName: string;
  nationalId: string;
  isValid: boolean;
  errors: string[];
};

// Öğrenci No burada YOK — "2026-1001" formatındaki kısa kurumsal kod her
// zaman sunucu tarafında otomatik üretilir (bkz. generateStudentNumber).
export const STUDENT_COLUMNS = ["T.C. No", "Ad Soyad", "Şube", "Veli Ad Soyad", "Veli GSM", "Özel Not"] as const;
export const TEACHER_COLUMNS = ["T.C. No", "Ad Soyad", "Branş", "GSM", "E-posta", "Danışman Şube"] as const;

export function columnsFor(role: ImportRole): readonly string[] {
  return role === "STUDENT" ? STUDENT_COLUMNS : TEACHER_COLUMNS;
}
