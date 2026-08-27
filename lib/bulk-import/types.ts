export type ImportRole = "STUDENT" | "TEACHER" | "BRANCH";

// xlsx kütüphanesi, biçimi elle Metin'e çevrilmemiş rakamsal hücreleri
// (T.C. No, Sınıf Seviyesi vb.) JS number olarak döner — string değil.
// Bkz. lib/bulk-import/validate.ts > pick().
export type RawRow = Record<string, string | number | undefined>;

export type ValidatedRow = {
  rowIndex: number;
  raw: RawRow;
  // BRANCH satırlarında T.C. No/Ad Soyad kavramı yok — fullName burada
  // önizleme listesinde gösterilecek genel bir "satır etiketi" (şube adı),
  // nationalId boş string kalır. Tipi STUDENT/TEACHER ile ortak tutmak,
  // wizard'ın adım 3 önizleme UI'ının değişmeden 3 rol için de çalışmasını
  // sağlıyor.
  fullName: string;
  nationalId: string;
  isValid: boolean;
  errors: string[];
};

// Öğrenci No burada YOK — "2026-1001" formatındaki kısa kurumsal kod her
// zaman sunucu tarafında otomatik üretilir (bkz. generateStudentNumber).
// "Öğrenci GSM" giriş ekranının tek kimlik doğrulama yolu olduğu için
// zorunludur — kişisel telefonu olmayan öğrenciler için veli numarası
// tekrar girilebilir.
export const STUDENT_COLUMNS = ["T.C. No", "Ad Soyad", "Öğrenci GSM", "Şube", "Veli Ad Soyad", "Veli GSM", "Özel Not"] as const;
export const TEACHER_COLUMNS = ["T.C. No", "Ad Soyad", "Branş", "GSM", "E-posta", "Danışman Şube"] as const;
// Segment: LGS | YKS | MEZUN — Sınıf Seviyesi: LGS için 5-8, YKS için 9-12,
// MEZUN için temsili olarak 12 yazılabilir (bkz. lib/server/admin/branches.ts).
export const BRANCH_COLUMNS = ["Şube Adı", "Sınıf Seviyesi", "Segment", "Alan/Dal"] as const;

export function columnsFor(role: ImportRole): readonly string[] {
  if (role === "STUDENT") return STUDENT_COLUMNS;
  if (role === "TEACHER") return TEACHER_COLUMNS;
  return BRANCH_COLUMNS;
}
