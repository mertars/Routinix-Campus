import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

// Tek şehirli kurum varsayımı — INSTITUTION_NAME ("Arslan Dershaneleri")
// bir şehir alanı taşımıyor. Çoklu kampüs/şehir eklenirse bu sabit yerine
// Branch üzerinde gerçek bir "city" alanı gerekir.
export const INSTITUTION_CITY_ABBR = "IST";

// Eşleşen kayıtları STRING sırasına göre değil, sondaki sayısal parçaya göre
// karşılaştırıp gerçek maksimumu bulur — bir satırın sonu sayısal olmayan
// (bozuk/test) bir değer taşısa bile ("2026-E2E-01" gibi) diğer satırların
// doğru sırasını bozmaz. findFirst+orderBy (lexicographic) burada YETERSİZ
// kalıyordu çünkü "E" > "1" ASCII'de, bozuk bir kayıt "en son" sanılabiliyordu.
async function maxNumericSuffix(values: string[], prefixLength: number): Promise<number> {
  let max = 0;
  for (const value of values) {
    const n = Number(value.slice(prefixLength));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

// Öğrenci No: {yıl}-{4 haneli sıralı} — örn. "2026-1001". Sıra numarası o
// yılın İÇİNDE ve AYNI KURUM içinde, mevcut en yüksek numaraya göre ilerler
// (1000'den başlar) — Student.studentNumber artık global değil, kurum bazlı
// benzersiz (bkz. prisma/schema.prisma > @@unique([institutionId, studentNumber])),
// bu yüzden iki farklı kurum aynı yıl içinde aynı numaradan başlayabilir.
export async function generateStudentNumber(tx: Tx, institutionId: string, year = new Date().getFullYear()): Promise<string> {
  const prefix = `${year}-`;
  const matches = await tx.student.findMany({
    where: { institutionId, studentNumber: { startsWith: prefix } },
    select: { studentNumber: true },
  });
  const max = await maxNumericSuffix(matches.map((m) => m.studentNumber), prefix.length);
  const nextSeq = Math.max(max, 1000) + 1;
  return `${prefix}${nextSeq}`;
}

// Öğretmen Kodu: "TCH-" + 3 haneli benzersiz numara — örn. "TCH-102" — kurum
// bazlı benzersiz (bkz. Teacher.@@unique([institutionId, institutionalCode])).
export async function generateTeacherCode(tx: Tx, institutionId: string): Promise<string> {
  const matches = await tx.teacher.findMany({
    where: { institutionId, institutionalCode: { startsWith: "TCH-" } },
    select: { institutionalCode: true },
  });
  const max = await maxNumericSuffix(matches.map((m) => m.institutionalCode!), 4);
  const nextSeq = Math.max(max, 100) + 1;
  return `TCH-${String(nextSeq).padStart(3, "0")}`;
}

// Şube Kodu: "RTX-" + Şehir Kısaltması + 2 haneli sıra — örn. "RTX-IST01" —
// kurum bazlı benzersiz (bkz. Branch.@@unique([institutionId, institutionalCode])).
export async function generateBranchCode(tx: Tx, institutionId: string, cityAbbr = INSTITUTION_CITY_ABBR): Promise<string> {
  const prefix = `RTX-${cityAbbr}`;
  const matches = await tx.branch.findMany({
    where: { institutionId, institutionalCode: { startsWith: prefix } },
    select: { institutionalCode: true },
  });
  const max = await maxNumericSuffix(matches.map((m) => m.institutionalCode!), prefix.length);
  const nextSeq = max + 1;
  return `${prefix}${String(nextSeq).padStart(2, "0")}`;
}
