// app/api/admin/dashboard/route.ts ve app/api/risk-radar/route.ts, aynı
// Prisma groupBy sonucunu (öğrenci başına durum sayıları) birebir aynı
// döngüyle Map'e indirgiyordu — kopyalanmış kod, bir kez zaten (netResults
// sıralaması) burada bir doğruluk hatasına yol açtığı için tek bir saf
// fonksiyona çıkarıldı.
export function buildStatusCountMap(
  rows: { studentId: string; status: string; _count: number }[],
  positiveStatuses: readonly string[]
): Map<string, { positive: number; total: number }> {
  const map = new Map<string, { positive: number; total: number }>();
  for (const row of rows) {
    const entry = map.get(row.studentId) ?? { positive: 0, total: 0 };
    entry.total += row._count;
    if (positiveStatuses.includes(row.status)) entry.positive += row._count;
    map.set(row.studentId, entry);
  }
  return map;
}
