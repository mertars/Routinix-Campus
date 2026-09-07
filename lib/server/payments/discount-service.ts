import { prisma } from "@/lib/server/prisma";

export const DISCOUNT_TYPE_LABEL: Record<string, string> = {
  SIBLING: "Kardeş İndirimi",
  MERIT: "Başarı Bursu",
  EARLY_REGISTRATION: "Erken Kayıt",
  STAFF_CHILD: "Personel Çocuğu",
  FINANCIAL_AID: "İhtiyaç Bursu",
  OTHER: "Diğer",
};

export type DiscountBreakdownRow = { id: string; type: string; label: string; valueType: string; value: number; amount: number };
export type DiscountCalculation = {
  listAmount: number;
  discountTotal: number;
  netAmount: number;
  rows: DiscountBreakdownRow[];
};

// Bir öğrencinin aktif indirimlerini liste fiyatına uygular.
//
// SIRALAMA KURALI: önce SABİT (FIXED) tutarlar düşülür, sonra kalan üzerine
// YÜZDELER uygulanır. Aksi halde aynı indirim seti farklı sırada farklı net
// üretirdi ve "neden bu rakam çıktı" açıklanamazdı. Toplam indirim liste
// fiyatını AŞAMAZ (net asla negatif olmaz).
export function applyDiscounts(
  listAmount: number,
  discounts: { id: string; type: string; valueType: string; value: number }[]
): DiscountCalculation {
  const rows: DiscountBreakdownRow[] = [];
  let remaining = listAmount;

  for (const d of discounts.filter((x) => x.valueType === "FIXED")) {
    const amount = Math.min(remaining, d.value);
    remaining -= amount;
    rows.push({ id: d.id, type: d.type, label: DISCOUNT_TYPE_LABEL[d.type] ?? d.type, valueType: d.valueType, value: d.value, amount });
  }

  for (const d of discounts.filter((x) => x.valueType === "PERCENTAGE")) {
    const amount = Math.round(remaining * (Math.min(100, Math.max(0, d.value)) / 100) * 100) / 100;
    remaining -= amount;
    rows.push({ id: d.id, type: d.type, label: DISCOUNT_TYPE_LABEL[d.type] ?? d.type, valueType: d.valueType, value: d.value, amount });
  }

  const netAmount = Math.round(Math.max(0, remaining) * 100) / 100;
  return {
    listAmount,
    discountTotal: Math.round((listAmount - netAmount) * 100) / 100,
    netAmount,
    rows,
  };
}

export async function getActiveDiscounts(institutionId: string, studentId: string, academicYear: string) {
  const rows = await prisma.studentDiscount.findMany({
    where: { institutionId, studentId, academicYear, isActive: true },
    select: { id: true, type: true, valueType: true, value: true },
  });
  return rows.map((r) => ({ id: r.id, type: r.type as string, valueType: r.valueType as string, value: Number(r.value) }));
}
