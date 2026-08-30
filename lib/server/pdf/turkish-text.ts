// ⚠️ TARİHÇE — bu dosya ARTIK bir karakter değiştirme YAPMIYOR, kasıtlı
// olarak identity fonksiyon. Önceki halinde HER "ı" (noktasız küçük i,
// U+0131) karakteri "l" ile DEĞİŞTİRİLİYORDU çünkü bir önceki oturumda
// "react-pdf'in kendi metin işleme hattında ı HER ZAMAN '1' render ediyor,
// fonttan bağımsız kanıtlanmış bir kusur" sonucuna varılmıştı.
//
// Bu teşhis YANLIŞTI. Gerçek kök neden: o dönem PDF'lerde kullanılan font
// (bkz. lib/server/pdf/fonts.ts) SADECE Google'ın "latin-ext" alt-kümesini
// içeriyordu — bu alt-kümede 'ı' glifi HİÇ YOKTU (ne 'latin' ne 'latin-ext'
// tek başına Türkçe'nin ihtiyacı olan TÜM harfleri kapsıyor, ikisinin
// BİRLEŞİMİ gerekiyor). Font glifi bulamayınca react-pdf/fontkit sessizce
// bir fallback'e düşüyor ve SONUÇ olarak yanlış/rastgele bir glif
// çiziliyordu — bu, "ı hep '1' olur" şeklinde yanlış yorumlanmış, kalıcı
// çözüm sanılarak HER PDF metnindeki 'ı' harfi 'l' ile değiştirilmişti.
// Bu "çözüm" gerçekte YENİ bir görünür hata yaratıyordu: kurum/öğrenci
// isimlerindeki (örn. "Yıldız" -> "Yldz/YLDZ") her 'ı' sessizce 'l'ye
// dönüşüyordu — kullanıcının fark ettiği "l ve ı harfi karışıyor" şikayeti
// tam olarak BUYDU.
//
// Kalıcı/doğru çözüm: fontu 'latin' (a-z/A-Z/rakam/ö/ü/ç/ı) + 'latin-ext'
// (ğ/ş/İ) + gerekli matematik sembolleri birleştirecek şekilde yeniden
// üretmek oldu (bkz. fonts.ts'teki ayrıntılı prosedür) — bu font ARTIK 'ı'
// glifini doğru içeriyor, bu yüzden herhangi bir karakter ikamesine hiç
// gerek yok. Fonksiyonlar SADECE tüm PDF şablonlarındaki (~100 çağrı
// noktası) mevcut `t(...)` sarmalayıcısını bozmamak için identity olarak
// bırakıldı — ileride PDF metnine özel bir dönüşüm gerekirse tek bir
// noktadan (buradan) eklenebilir.
export function turkishSafe(value: string): string {
  return value;
}

// Sayısal/opsiyonel alanlar için kısayol — null/undefined ise olduğu gibi
// bırakır, aksi halde turkishSafe uygular.
export function turkishSafeOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return turkishSafe(value);
}
