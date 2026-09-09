// Gündem penceresi Türkiye takvimine göre hesaplanır.
//
// ⚠️ Sunucunun saat dilimine GÜVENİLMEZ. Vercel UTC'de koşuyor; "bugün"ü
// sunucu yerel saatiyle hesaplasaydık gece 00:00–03:00 arasında müdüre
// dünün gündemi gösterilirdi. Aynı sınıftan bir hata bu projede zaten
// veri bozulmasına yol açtı (bkz. lib/attendance/date-key.ts).
//
// AttendanceRecord'ın gün anahtarından farkı: oradaki alan bir gün
// etiketidir (UTC gece yarısı), buradakiler ise gerçek ZAMAN DAMGASI
// alanlarıyla (dueDate, promisedDate, examDate) karşılaştırılacak
// anlardır. Bu yüzden ayrı bir yardımcı.

const TZ = "Europe/Istanbul";

const PART_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Verilen anda Türkiye saatinin UTC'ye farkı (ms). DST değişse de doğru kalır. */
function offsetMs(at: Date): number {
  const parts = Object.fromEntries(PART_FORMAT.formatToParts(at).map((p) => [p.type, p.value]));
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    // Bazı Node sürümleri gece yarısını hour12:false ile "24" verir.
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUtc - at.getTime();
}

/** Türkiye'de o günün gece yarısına denk gelen an. */
export function trStartOfDay(at: Date): Date {
  const offset = offsetMs(at);
  const shifted = new Date(at.getTime() + offset);
  const midnight = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(midnight - offset);
}

/** Türkiye'de o günün bitişi (ertesi günün gece yarısı). */
export function trEndOfDay(at: Date): Date {
  return trStartOfDay(new Date(trStartOfDay(at).getTime() + 36 * 3_600_000));
}

/** Bugünden itibaren n gün sonrasının Türkiye günü bitişi. */
export function trEndOfDayIn(at: Date, days: number): Date {
  return trEndOfDay(new Date(trStartOfDay(at).getTime() + days * 86_400_000 + 12 * 3_600_000));
}

/** Türkiye takvimine göre ay anahtarı — "2026-09". */
export function trMonthKey(at: Date): string {
  const parts = Object.fromEntries(PART_FORMAT.formatToParts(at).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}`;
}

/** Türkiye takvimine göre ayın kaçıncı günü. */
export function trDayOfMonth(at: Date): number {
  const parts = Object.fromEntries(PART_FORMAT.formatToParts(at).map((p) => [p.type, p.value]));
  return Number(parts.day);
}
