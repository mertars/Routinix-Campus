// Bir tutarı N taksite bölerken kuruş küsuratı kaybolmamalıdır: taksitlerin
// TOPLAMI her zaman bölünen tutara BİREBİR eşit olmalı. Aksi halde 12
// taksitlik bir planda birkaç kuruş kaybolur, öğrencinin borcu asla tam
// kapanmaz ve "kalan 0,04 ₺" gibi hayalet bakiyeler oluşur.
//
// Yöntem: taksit başına tutar AŞAĞI yuvarlanır, biriken fark SON taksite
// eklenir. Bu mantık daha önce taksit planı ve borç yapılandırma
// route'larında AYRI AYRI kopyalanmıştı — biri düzeltilip diğeri unutulursa
// iki akış farklı rakam üretirdi, bu yüzden tek yere alındı.
export function splitIntoInstallments(total: number, count: number): number[] {
  if (!Number.isFinite(total) || total <= 0) throw new Error("total pozitif bir sayı olmalı.");
  if (!Number.isInteger(count) || count < 1) throw new Error("count en az 1 olmalı.");

  const per = Math.floor((total / count) * 100) / 100;
  const last = Math.round((total - per * (count - 1)) * 100) / 100;
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? last : per));
}
