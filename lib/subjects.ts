// ----------------------------------------------------------------------------
// DERS TAKSONOMİSİ — "bu sistemde hangi dersler var" sorusunun TEK KAYNAĞI.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15, TEKRAR EDEN şikâyet): "lisede fen ve sosyal
// diye ders yok; fizik, kimya, biyoloji, tarih, coğrafya, felsefe, din var.
// Heryerde bunu düzelt." Hata tek bir ekranda değildi — KÖK NEDEN, sistemde
// ders listesinin tek bir kaynağının OLMAMASIYDI: her ekran dersleri elindeki
// veriden türetiyordu ve o veri ekrandan ekrana farklıydı.
//
// Ölçüldü (2026-09-15, canlı veritabanı):
//   LessonSlot (gerçek ders programı) → Fizik, Kimya, Biyoloji, Tarih,
//     Coğrafya, Edebiyat, Geometri, İngilizce... yani ZATEN DOĞRU.
//   ExamNetResult (deneme sonuçları) → "Fen Bilimleri"(224), "Sosyal
//     Bilimler"(107), "Fen"(102), "Sosyal"(102), "Fen II"(30)... KİRLİ.
// Çalışma programı ekranı dersleri deneme sonuçlarından türettiği için
// "fenden 100 soru çöz" gibi işlevsiz bir plan çıkıyordu.
//
// KURAL: Öğrenciye iş atayan (program, ödev, hedef) HİÇBİR ekran ders
// listesini ham veriden türetmez — buradan alır.
// ----------------------------------------------------------------------------

export type SchoolLevel = "ortaokul" | "lise";

/**
 * Sınıf seviyesinden kademe. 8 ve altı ortaokul, 9+ lise.
 * Mezun grubu (grade temsili tutulur, bkz. schema.prisma > BranchSegment)
 * lise sayılır — YKS'ye çalışır.
 */
export function levelOfGrade(grade: number | null | undefined): SchoolLevel {
  return (grade ?? 12) <= 8 ? "ortaokul" : "lise";
}

/**
 * Kademe başına GERÇEK dersler.
 *
 * ⚠️ "Fen Bilimleri" ve "Sosyal Bilgiler" ORTAOKULDA gerçek birer derstir
 * (MEB 5-8 müfredatı) — orada bırakmak DOĞRU. Lisede ise böyle bir ders
 * yoktur; Mert'in şikâyeti tam olarak lise listesinde bunların görünmesiydi.
 */
export const SUBJECTS_BY_LEVEL: Record<SchoolLevel, string[]> = {
  ortaokul: ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"],
  lise: [
    "Türkçe",
    "Edebiyat",
    "Matematik",
    "Geometri",
    "Fizik",
    "Kimya",
    "Biyoloji",
    "Tarih",
    "Coğrafya",
    "Felsefe",
    "Din Kültürü ve Ahlak Bilgisi",
    "İngilizce",
  ],
};

/**
 * DENEME KİTAPÇIĞI bölümleri → gerçek dersler.
 *
 * TYT'nin optik formunda "Fen Bilimleri" ve "Sosyal Bilimler" GERÇEKTEN tek
 * bölüm olarak vardır — bu yüzden deneme sonuçlarında o adla kayıt olması
 * başlı başına bir hata DEĞİLDİR. Hata, o adı ÇALIŞMA PLANINA taşımaktır:
 * "Fen Bilimleri'nden 100 soru çöz" bir öğrenciye hiçbir şey söylemez.
 *
 * Bu eşleme iki işe yarar: (1) plan ekranı bu adları ders listesine ALMAZ,
 * (2) netleri gösterirken "hangi gerçek dersleri kapsıyor" diye açıklar.
 */
export const AGGREGATE_SUBJECTS: Record<string, string[]> = {
  "Fen Bilimleri": ["Fizik", "Kimya", "Biyoloji"],
  Fen: ["Fizik", "Kimya", "Biyoloji"],
  "Fen II": ["Fizik", "Kimya", "Biyoloji"],
  "Sosyal Bilimler": ["Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  Sosyal: ["Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  "Sosyal II": ["Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
};

/** Bu ad bir kitapçık bölümü mü (gerçek bir ders değil)? */
export function isAggregateSubject(subject: string, level: SchoolLevel = "lise"): boolean {
  // Ortaokulda "Fen Bilimleri"/"Sosyal Bilgiler" GERÇEK derstir — orada
  // toplayıcı sayılmaz.
  if (level === "ortaokul") return false;
  return subject in AGGREGATE_SUBJECTS;
}

/** Toplayıcı bir adı gerçek derslere açar; gerçek ders ise kendisini döner. */
export function expandSubject(subject: string, level: SchoolLevel = "lise"): string[] {
  if (level === "ortaokul") return [subject];
  return AGGREGATE_SUBJECTS[subject] ?? [subject];
}

/**
 * Bir öğrenciye plan yazarken kullanılabilecek ders listesi.
 *
 * Kademenin standart dersleri + öğrencinin GERÇEKTEN gördüğü dersler
 * (ders programından gelen, kurumun kendi açtığı seçmeliler dahil)
 * birleştirilir; kitapçık bölümleri ("Fen Bilimleri" vb.) ELENİR.
 */
export function planningSubjects(grade: number | null | undefined, taughtSubjects: string[] = []): string[] {
  const level = levelOfGrade(grade);
  const base = SUBJECTS_BY_LEVEL[level];
  const extra = taughtSubjects.filter(
    (s) => s && !isAggregateSubject(s, level) && !base.includes(s) && s !== "Rehberlik"
  );
  return [...base, ...new Set(extra)];
}
