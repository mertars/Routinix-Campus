// app/api/admin/dashboard/route.ts ve app/api/risk-radar/route.ts, aynı
// Prisma groupBy sonucunu (öğrenci başına durum sayıları) birebir aynı
// döngüyle Map'e indirgiyordu — kopyalanmış kod, bir kez zaten (netResults
// sıralaması) burada bir doğruluk hatasına yol açtığı için tek bir saf
// fonksiyona çıkarıldı.
// excludedStatuses: paydaya HİÇ girmeyen durumlar. Yoklamada "İzinli"
// böyledir — raporlu öğrenci ne olumlu sayılmalı (oranı şişirir) ne de
// olumsuz (mazereti olanı cezalandırır); bkz. lib/attendance/status.
export function buildStatusCountMap(
  rows: { studentId: string; status: string; _count: number }[],
  positiveStatuses: readonly string[],
  excludedStatuses: readonly string[] = []
): Map<string, { positive: number; total: number }> {
  const map = new Map<string, { positive: number; total: number }>();
  for (const row of rows) {
    if (excludedStatuses.includes(row.status)) continue;
    const entry = map.get(row.studentId) ?? { positive: 0, total: 0 };
    entry.total += row._count;
    if (positiveStatuses.includes(row.status)) entry.positive += row._count;
    map.set(row.studentId, entry);
  }
  return map;
}
