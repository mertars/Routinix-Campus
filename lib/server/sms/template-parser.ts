// "Sayın {veli_adi}, öğrencimiz {ogrenci_adi} ..." → parametreleri doldurur.
// Bilinmeyen bir {parametre} varsa olduğu gibi bırakır (sessizce silmez) ki
// eksik veri fark edilebilir kalsın.
export function renderTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? params[key] : match));
}

// Bir şablonun beklediği tüm {parametre} adlarını çıkarır — UI'da "bu
// şablon şu alanları bekliyor" göstermek için kullanılabilir.
export function extractTemplateParams(template: string): string[] {
  const matches = template.matchAll(/\{(\w+)\}/g);
  return Array.from(new Set(Array.from(matches, (m) => m[1])));
}
