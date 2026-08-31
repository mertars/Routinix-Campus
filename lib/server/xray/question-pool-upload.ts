// prisma/seed-xray-practice-test.ts'teki AYNI slugify — testId üretimi
// (bkz. o dosyadaki yorum, app/api/xray/practice-questions/upload'taki
// kullanım) TEK doğru kaynak burada, iki yerde ayrı ayrı bakımı gerekmesin
// diye.
export function slugifyTestName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
