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
// yılın İÇİNDE, mevcut en yüksek numaraya göre ilerler (1000'den başlar).
export async function generateStudentNumber(tx: Tx, year = new Date().getFullYear()): Promise<string> {
  const prefix = `${year}-`;
  const matches = await tx.student.findMany({
    where: { studentNumber: { startsWith: prefix } },
    select: { studentNumber: true },
  });
  const max = await maxNumericSuffix(matches.map((m) => m.studentNumber), prefix.length);
  const nextSeq = Math.max(max, 1000) + 1;
  return `${prefix}${nextSeq}`;
}

// Öğretmen Kodu: "TCH-" + 3 haneli benzersiz numara — örn. "TCH-102".
export async function generateTeacherCode(tx: Tx): Promise<string> {
  const matches = await tx.teacher.findMany({
    where: { institutionalCode: { startsWith: "TCH-" } },
    select: { institutionalCode: true },
  });
  const max = await maxNumericSuffix(matches.map((m) => m.institutionalCode!), 4);
  const nextSeq = Math.max(max, 100) + 1;
  return `TCH-${String(nextSeq).padStart(3, "0")}`;
}

// Şube Kodu: "RTX-" + Şehir Kısaltması + 2 haneli sıra — örn. "RTX-IST01".
export async function generateBranchCode(tx: Tx, cityAbbr = INSTITUTION_CITY_ABBR): Promise<string> {
  const prefix = `RTX-${cityAbbr}`;
  const matches = await tx.branch.findMany({
    where: { institutionalCode: { startsWith: prefix } },
    select: { institutionalCode: true },
  });
  const max = await maxNumericSuffix(matches.map((m) => m.institutionalCode!), prefix.length);
  const nextSeq = max + 1;
  return `${prefix}${String(nextSeq).padStart(2, "0")}`;
}
