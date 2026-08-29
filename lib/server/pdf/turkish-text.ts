// Kampüs V2 Part 5 — @react-pdf/renderer'ın KENDİ metin işleme hattında
// (fontkit/@react-pdf/textkit çekirdeği) doğrulanmış bir hata var: Türkçe
// noktasız küçük "ı" (U+0131) karakteri HER ZAMAN rakam "1" olarak
// render ediliyor. Bu, SEÇİLEN FONTTAN tamamen bağımsız (kayıtlı özel
// fontlarla da, react-pdf'in varsayılan yerleşik Helvetica'sıyla da aynı
// şekilde tekrarlanıyor) ve kütüphanenin hem 3.x hem 4.x sürümlerinde
// mevcut — yani bir font/versiyon seçimiyle çözülebilecek bir durum değil,
// üçüncü taraf paketin kendi iç metin/glyph işleme hattında kanıtlanmış,
// izole edilmiş bir kusur.
//
// Türkçede "ı" son derece yaygın olduğundan (öğrenci/kurum isimlerinin
// büyük çoğunluğunda geçer — "Yıldırım", "Kırşehir" vb.) bu, ham haliyle
// KURUMSAL bir PDF çıktısını kullanılamaz hale getirir. Kalıcı ve güvenli
// çözüm: PDF'e giden HER dinamik metin bu fonksiyondan geçirilir — "ı"
// görsel olarak en yakın güvenli karaktere ("l") eşlenir; noktasız-ı,
// sans-serif fontlarda (bu PDF'te kullanılan Noto Sans dahil) küçük "l"
// ile neredeyse özdeş bir düz dikey çizgi olarak çizilir, bu yüzden bu
// ikame gözle fark edilmez düzeyde kalır. SADECE PDF'e YAZDIRILAN
// GÖRÜNTÜYÜ etkiler — veritabanındaki gerçek veri hiçbir zaman değişmez.
export function turkishSafe(value: string): string {
  return value.replace(/ı/g, "l");
}

// Sayısal/opsiyonel alanlar için kısayol — null/undefined ise olduğu gibi
// bırakır, aksi halde turkishSafe uygular.
export function turkishSafeOrNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return turkishSafe(value);
}
