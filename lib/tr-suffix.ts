// Türkçe iyelik eki — "3 dersin 2'si", "19'u", "40'ı".
//
// Sayıdan sonra gelen ek, sayının OKUNUŞUNA göre değişir; sabit "'i"
// yazmak yarı yarıya yanlış sonuç verir ("2'i", "40'i", "100'i").
// Kural: ekin sesi, sayının son SÖZCÜĞÜNÜN son ünlüsüne uyar ve ünlüyle
// biten sözcüklerden sonra araya "s" girer.
//
//   1 bir  → biri    → 1'i        6 altı   → altısı  → 6'sı
//   2 iki  → ikisi   → 2'si       7 yedi   → yedisi  → 7'si
//   3 üç   → üçü     → 3'ü        8 sekiz  → sekizi  → 8'i
//   4 dört → dördü   → 4'ü        9 dokuz  → dokuzu  → 9'u
//   5 beş  → beşi    → 5'i       10 on     → onu     → 10'u
//
// Sıfırla biten sayılarda son sözcük onluk/yüzlük/binliktir:
//   20 yirmi → yirmisi → 20'si     100 yüz  → yüzü    → 100'ü
//   40 kırk  → kırkı   → 40'ı     1000 bin  → bini    → 1000'i

const ONES: Record<number, string> = {
  1: "i",
  2: "si",
  3: "ü",
  4: "ü",
  5: "i",
  6: "sı",
  7: "si",
  8: "i",
  9: "u",
};

const TENS: Record<number, string> = {
  10: "u",
  20: "si",
  30: "u",
  40: "ı",
  50: "si",
  60: "ı",
  70: "i",
  80: "i",
  90: "ı",
};

/** Sayıya gelecek iyelik ekini döndürür (kesme işareti HARİÇ). */
export function trPossessiveSuffix(value: number): string {
  const n = Math.abs(Math.trunc(value));
  if (n === 0) return "ı"; // sıfırı
  if (n % 1_000_000 === 0) return "u"; // milyonu
  if (n % 1000 === 0) return "i"; // bini
  if (n % 100 === 0) return "ü"; // yüzü
  const ones = n % 10;
  if (ones !== 0) return ONES[ones];
  return TENS[n % 100];
}

/** "3 dersin 2'si" cümlesindeki ikinci parça: sayı + kesme + doğru ek. */
export function trPossessive(value: number): string {
  return `${value}'${trPossessiveSuffix(value)}`;
}
