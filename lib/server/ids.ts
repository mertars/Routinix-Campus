import { randomUUID } from "crypto";

// Yeni oluşturulan kayıtlar için tür-önekli benzersiz ID (UUID v4 + prefix).
// ⚠️ Bilinçli olarak SADECE yeni kayıtlarda kullanılır — prisma/seed.ts'teki
// demo veriler (Student "1".."98", Teacher "1".."5" vb.) KASITLI olarak
// düz sayısal ID taşır, çünkü lib/teacher-scope.ts / lib/student-scope.ts
// ve tüm demo-persona eşlemesi bu ID'lere sabit referans verir (bkz. o
// dosyalardaki TEACHER_ID_BY_PERSONA_NAME / STUDENT_ID). Mevcut demo
// verisini bu şemaya geçirmek, üzerine kurulu tüm persona sistemini kırar.
export type PrefixedIdType = "std" | "tch" | "adm" | "prt";

export function generatePrefixedId(type: PrefixedIdType): string {
  return `${type}_${randomUUID()}`;
}
