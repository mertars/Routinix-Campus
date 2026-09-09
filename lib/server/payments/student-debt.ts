import { prisma } from "@/lib/server/prisma";

// ÖĞRENCİ BORCU — tek tanım.
//
// Bu dosya var çünkü "kalan borç" hesabı EN AZ BEŞ ayrı yere elle
// yazılmıştı (günlük özet, yapılandırma ×2, nakit akışı, genel arama,
// kayıt yenileme). Hepsi bugün aynı şeyi yapıyor; biri değiştiğinde
// veliye gösterilen rakamla müdüre gösterilen rakamın ayrışması için
// tek bir düzenleme yeterliydi.
//
// Kural: AÇIK taksitlerin tutarı eksi o taksitlere yapılmış TAMAMLANMIŞ
// ödemeler. İptal edilmiş taksit borç değildir; iptal edilmiş (VOID)
// ödeme de tahsilat sayılmaz.

export const OPEN_INSTALLMENT_STATUSES = ["PENDING", "PARTIALLY_PAID"] as const;

/** Kuruş hatası birikmesin diye iki basamağa yuvarlar. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type DebtRow = {
  amount: unknown;
  payments: { amount: unknown }[];
};

// Satır tabanlı hesap — çağıran taraf taksitleri zaten çekmişse.
export function computeRemaining(installments: DebtRow[]): number {
  return round2(
    installments.reduce(
      (sum, i) => sum + (Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)),
      0
    )
  );
}

export type StudentDebt = {
  studentId: string;
  openDebt: number;
  overdueDebt: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
};

// Birden çok öğrencinin borcunu TEK sorguda hesaplar.
//
// Öğrenci başına sorgu atmak, iki çocuklu bir velide iki, 100 öğrencili
// bir listede 100 gidiş dönüş demekti (bkz. bu fazda düzeltilen aynı
// sınıf sorunlar).
export async function getStudentDebts(studentIds: string[]): Promise<Map<string, StudentDebt>> {
  const result = new Map<string, StudentDebt>();
  if (studentIds.length === 0) return result;

  const installments = await prisma.installment.findMany({
    where: { studentId: { in: studentIds }, status: { in: [...OPEN_INSTALLMENT_STATUSES] } },
    select: {
      studentId: true,
      amount: true,
      dueDate: true,
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  for (const id of studentIds) {
    result.set(id, { studentId: id, openDebt: 0, overdueDebt: 0, nextDueDate: null, nextDueAmount: null });
  }

  for (const inst of installments) {
    const entry = result.get(inst.studentId);
    if (!entry) continue;

    const remaining = Number(inst.amount) - inst.payments.reduce((s, p) => s + Number(p.amount), 0);
    // Fazla tahsilat teorik olarak engelli (bkz. tahsilat kilidi) ama
    // negatif bir kalan borcu toplama katmak yanlış olur.
    if (remaining <= 0) continue;

    entry.openDebt = round2(entry.openDebt + remaining);
    if (inst.dueDate < now) {
      entry.overdueDebt = round2(entry.overdueDebt + remaining);
    } else if (entry.nextDueDate === null) {
      // Taksitler vade sırasına göre geldiği için ilk gelecek vade
      // "sıradaki ödeme"dir.
      entry.nextDueDate = inst.dueDate.toISOString();
      entry.nextDueAmount = round2(remaining);
    }
  }

  return result;
}
