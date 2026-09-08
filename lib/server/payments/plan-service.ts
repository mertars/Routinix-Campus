import { prisma } from "@/lib/server/prisma";
import { applyDiscounts, getActiveDiscounts } from "@/lib/server/payments/discount-service";
import { splitIntoInstallments } from "@/lib/server/payments/installment-math";

export type PlanOptions = {
  institutionId: string;
  studentId: string;
  /** LİSTE fiyatı — öğrencinin indirimleri burada uygulanır. */
  listAmount: number;
  installmentCount: number;
  startDate: Date;
  titlePrefix: string;
  academicYear: string;
};

export type PlanResult = {
  createdCount: number;
  listAmount: number;
  discountTotal: number;
  netAmount: number;
  appliedDiscounts: { label: string; amount: number }[];
};

// Tek öğrenci için taksit planı üretir.
//
// Tekil ve TOPLU atama uçlarının ORTAK yolu: indirim uygulaması, kuruş
// bölüşümü ve indirim anlık kaydı tek yerde durur. İki ayrı kopya
// olsaydı, biri değişip diğeri unutulduğunda aynı öğrenci hangi ekrandan
// plan kurulduğuna göre FARKLI borçlanırdı.
export async function createInstallmentPlan(opts: PlanOptions): Promise<PlanResult> {
  const activeDiscounts = await getActiveDiscounts(opts.institutionId, opts.studentId, opts.academicYear);
  const calc = applyDiscounts(opts.listAmount, activeDiscounts);
  const netAmount = calc.netAmount;
  if (netAmount <= 0) {
    throw new Error("İndirimler sonrası net tutar sıfır — taksit planı oluşturulamaz.");
  }

  const amounts = splitIntoInstallments(netAmount, opts.installmentCount);
  const rows = amounts.map((amount, i) => {
    const dueDate = new Date(opts.startDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    return {
      institutionId: opts.institutionId,
      studentId: opts.studentId,
      title: `${opts.titlePrefix} - Taksit ${i + 1}/${opts.installmentCount}`,
      amount,
      dueDate,
    };
  });
  await prisma.installment.createMany({ data: rows });

  // İndirim anlık kaydı — plan üretildiği AN'daki liste/indirim tutarları
  // indirim satırlarına yazılır (bkz. schema > StudentDiscount).
  if (calc.discountTotal > 0) {
    const now = new Date();
    for (const row of calc.rows) {
      await prisma.studentDiscount.update({
        where: { id: row.id },
        data: { appliedListAmount: opts.listAmount, appliedDiscount: row.amount, appliedAt: now },
      });
    }
  }

  return {
    createdCount: rows.length,
    listAmount: opts.listAmount,
    discountTotal: calc.discountTotal,
    netAmount,
    appliedDiscounts: calc.rows.map((r) => ({ label: r.label, amount: r.amount })),
  };
}

// Bir öğrencinin AÇIK (iptal edilmemiş) taksiti var mı.
//
// Toplu atamada zorunlu: aynı sınıfa ikinci kez plan kurulduğunda daha
// önce planı olan öğrenciye İKİNCİ bir plan çıkar ve borcu iki katına
// fırlar. Bu sessiz olsaydı fark edilmesi aylar alırdı.
export async function findStudentsWithExistingPlan(institutionId: string, studentIds: string[]): Promise<Set<string>> {
  if (studentIds.length === 0) return new Set();
  const rows = await prisma.installment.findMany({
    where: { institutionId, studentId: { in: studentIds }, status: { not: "CANCELLED" } },
    select: { studentId: true },
    distinct: ["studentId"],
  });
  return new Set(rows.map((r) => r.studentId));
}
