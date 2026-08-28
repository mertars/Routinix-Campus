// Etüt Randevu Modülü'nün saf çekirdeği: bir öğretmenin bir gün için
// TANIMLADIĞI serbest aralık(lar)ı, o günkü mevcut rezervasyonlar (mola
// tamponuyla genişletilmiş) çıkarılarak kurum etüt süresine bölünmüş
// slotlara dönüştürür. DB'ye HİÇ dokunmaz — çağıran API route verileri
// (aralıklar, mevcut rezervasyonlar, süre, mola) toplayıp buraya verir.
//
// Örnek: aralık 15:00-16:30, süre 20dk, mola 10dk, 15:20-15:40 dolu →
// blok bölge [15:10,15:50) → kalan [15:00,15:10) (20dk'ya sığmıyor, elenir)
// ve [15:50,16:30) → bu ikinci parça 15:50-16:10, 16:10-16:30 slotlarına bölünür.

export type TimeRange = { startTime: string; endTime: string };

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function subtractBlock(free: [number, number][], block: [number, number]): [number, number][] {
  const result: [number, number][] = [];
  for (const [start, end] of free) {
    if (block[1] <= start || block[0] >= end) {
      result.push([start, end]); // örtüşme yok
      continue;
    }
    if (block[0] > start) result.push([start, Math.min(block[0], end)]);
    if (block[1] < end) result.push([Math.max(block[1], start), end]);
  }
  return result;
}

export function computeAvailableSlots(input: {
  ranges: TimeRange[]; // o güne ait TÜM müsaitlik aralıkları
  durationMinutes: number; // kurum etüt süresi
  breakMinutes: number; // öğretmenin mola süresi
  occupiedSlots: TimeRange[]; // o gün için mevcut (PENDING+APPROVED) randevular
}): string[] {
  const { durationMinutes, breakMinutes } = input;
  if (durationMinutes <= 0) return [];

  let free: [number, number][] = input.ranges
    .map((r) => [toMinutes(r.startTime), toMinutes(r.endTime)] as [number, number])
    .filter(([s, e]) => e > s);

  for (const occ of input.occupiedSlots) {
    const occStart = toMinutes(occ.startTime);
    const occEnd = toMinutes(occ.endTime);
    const block: [number, number] = [occStart - breakMinutes, occEnd + breakMinutes];
    free = subtractBlock(free, block);
  }

  const slots: string[] = [];
  for (const [start, end] of free) {
    let cursor = start;
    while (cursor + durationMinutes <= end) {
      slots.push(`${toHHMM(cursor)}-${toHHMM(cursor + durationMinutes)}`);
      cursor += durationMinutes;
    }
  }
  return slots.sort();
}
