// Eğitim-öğretim yılı hesabı.
//
// Bu dosya var çünkü "2025-2026" panelin SEKİZ ayrı yerine elle
// yazılmıştı. Sonuç sessiz ve pahalıydı: müdür 2026-2027 dönemine
// indirim tanımlıyor, plan kurulurken indirimler "2025-2026" için
// aranıyor, hiçbiri bulunamıyor ve öğrenci LİSTE FİYATINDAN
// borçlanıyor — ne hata ne uyarı çıkıyordu.
//
// SUNUCU BAĞIMLILIĞI YOK: hem route'lar hem client bileşenleri kullanır.

// Eğitim yılının başladığı ay (1-12). Türkiye'de öğretim yılı Eylül'de
// başlar; Ocak–Ağustos arası hâlâ bir ÖNCEKİ yılın dönemidir.
export const ACADEMIC_YEAR_START_MONTH = 9;

export function academicYearOf(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() + 1 >= ACADEMIC_YEAR_START_MONTH ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function currentAcademicYear(): string {
  return academicYearOf(new Date());
}

// Açılır listeler için: bir önceki, içinde bulunulan ve bir sonraki
// dönem. Müdür genelde bu üçünden biriyle çalışır; daha uzun bir liste
// yanlış seçim riskini artırır.
export function academicYearOptions(reference: Date = new Date()): string[] {
  const current = academicYearOf(reference);
  const startYear = Number(current.split("-")[0]);
  return [`${startYear - 1}-${startYear}`, current, `${startYear + 1}-${startYear + 2}`];
}
