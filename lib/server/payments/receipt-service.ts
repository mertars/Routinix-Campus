import { prisma } from "@/lib/server/prisma";

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
// 10^3, 10^6, 10^9 — bir dershane makbuzunda milyarın üstü gerçekçi değil.
const SCALES = ["", "bin", "milyon", "milyar"];

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  const parts: string[] = [];
  // "biryüz" DENMEZ, sadece "yüz" — Türkçenin kuralı.
  if (hundreds > 0) parts.push(hundreds === 1 ? "yüz" : `${ONES[hundreds]}yüz`);
  if (tens > 0) parts.push(TENS[tens]);
  if (ones > 0) parts.push(ONES[ones]);
  return parts.join("");
}

// Makbuzlarda zorunlu olan "tutar yazıyla" alanı. Örn:
//   7600.5 -> "yedibinaltıyüz TL elli Kr"
export function amountToTurkishWords(amount: number): string {
  const lira = Math.floor(Math.abs(amount));
  const kurus = Math.round((Math.abs(amount) - lira) * 100);

  function intToWords(value: number): string {
    if (value === 0) return "sıfır";
    const groups: number[] = [];
    let rest = value;
    while (rest > 0) {
      groups.push(rest % 1000);
      rest = Math.floor(rest / 1000);
    }
    const parts: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (g === 0) continue;
      // "birbin" DENMEZ, sadece "bin".
      if (i === 1 && g === 1) parts.push("bin");
      else parts.push(`${threeDigitsToWords(g)}${SCALES[i]}`);
    }
    return parts.join("");
  }

  const liraWords = intToWords(lira);
  if (kurus === 0) return `${liraWords} TL`;
  return `${liraWords} TL ${intToWords(kurus)} Kr`;
}

// Makbuz numarası kurum içinde artan sıradadır. Düşük hacimli, tek panelden
// yürüyen bir işlem olduğu için "en büyüğü bul, bir artır" deseni yeterli
// (projede smsCredits düşümünde de AYNI basit desen kullanılıyor; yarış
// durumunda unique kısıtı ikinci yazımı reddeder, çağıran taraf yeniden
// dener).
export async function nextReceiptNo(institutionId: string): Promise<number> {
  const last = await prisma.payment.findFirst({
    where: { institutionId, receiptNo: { not: null } },
    orderBy: { receiptNo: "desc" },
    select: { receiptNo: true },
  });
  return (last?.receiptNo ?? 0) + 1;
}

// Makbuzu olmayan (modül öncesi) bir tahsilata basım anında numara atar.
export async function ensureReceiptNo(paymentId: string, institutionId: string, current: number | null): Promise<number> {
  if (current != null) return current;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = await nextReceiptNo(institutionId);
    try {
      await prisma.payment.update({ where: { id: paymentId }, data: { receiptNo: candidate } });
      return candidate;
    } catch {
      // Unique çakışması — başka bir istek aynı numarayı aldı, tekrar dene.
    }
  }
  throw new Error("Makbuz numarası atanamadı.");
}
