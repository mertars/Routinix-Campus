// AYT alan (track) — ders eşlemesi. Kullanıcı kararı: "eşit ağırlıkçıya
// eşit ağırlık, sayısalcıya sayısal derslerindeki netler üzerinden
// değerlendirme yapmalıyız" — bir AYT denemesinde tüm alanların soruları
// AYNI kitapçıkta olabilir (öğrenci sadece kendi alanının modülünü
// cevaplar, diğerleri boş/0 net kalır), bu yüzden GENEL sıralamanın
// yanında alan bazlı sıralama da gerekir; TYT/LGS/sınıf seviye
// denemelerinde alan ayrımı YOKTUR ("sınırlama yok").
//
// Bu liste new-exam-wizard.tsx > TEMPLATE_PRESETS'teki AYT ders
// gruplarıyla AYNI (gerçek, standart YKS ders-alan eşlemesi — kurumdan
// kuruma değişmez) — BİLEREK burada tek bir yerde toplandı, iki dosyanın
// birbirinden habersiz sürüklenmesini önlemek için.
export const TRACK_SUBJECTS: Record<string, string[]> = {
  Sayısal: ["Matematik", "Fizik", "Kimya", "Biyoloji"],
  "Eşit Ağırlık": ["Matematik", "Edebiyat", "Tarih-1", "Coğrafya-1"],
  Sözel: ["Edebiyat-Coğrafya", "Tarih-2", "Coğrafya-2", "Felsefe Grubu"],
};

export const TRACK_NAMES = Object.keys(TRACK_SUBJECTS);

// Öğrencinin kendi alanı — Student.track VERİLMİŞSE (şube varsayılanını
// ezen özel bir durum) o kullanılır, yoksa Branch.track'e düşer.
export function effectiveTrack(studentTrack: string | null | undefined, branchTrack: string | null | undefined): string | null {
  return studentTrack ?? branchTrack ?? null;
}

// Bu sınavın ders kümesi herhangi bir alanla KESİŞİYORSA (yani en az bir
// alana özel ders varsa) alan bazlı sıralama ANLAMLIDIR — bir TYT/LGS
// denemesinde hiçbir ders bu listelerde geçmez, tek genel sıralama yeterli.
export function tracksPresentIn(subjects: string[]): string[] {
  const set = new Set(subjects);
  return TRACK_NAMES.filter((track) => TRACK_SUBJECTS[track].some((s) => set.has(s)));
}
