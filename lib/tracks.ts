import { levelOfGrade } from "@/lib/subjects";

// ----------------------------------------------------------------------------
// ALAN (SAYISAL / EŞİT AĞIRLIK / SÖZEL) ve SORUMLU DERSLER — tek kaynak.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-18): "öğrencinin sayısal, eşit ağırlık veya
// sözel olması önemli, ona göre dersleri belirleniyor. Bu seçim 11. sınıfın
// başında yapılıyor; 11, 12 ve mezun öğrenciler için önemli. Sorumlu olduğu
// derslere göre değerlendirmemiz lazım — TYT hepsinde ortak ama AYT
// konularında bir sayısalcıyı edebiyattan değerlendiremeyiz."
//
// ⚠️ ÖLÇÜLDÜ (2026-09-18, canlı veritabanı): `Branch.track` ve
// `Student.track` alanları VAR ama neredeyse tamamı null — Arslan'ın 102
// öğrencisinin ve 10 şubesinin HİÇBİRİNDE alan yazılı değil. Alan bilgisi
// yalnızca ŞUBE ADINDA duruyordu ("11-A Fen", "12-B Eşit Ağırlık"). Yani
// sistem alanı "biliyor" gibi görünüyor ama hiçbir hesap onu kullanamıyor.
// Bu dosya o boşluğu doldurur: alanı yazılı olmayan şubeler için ADINDAN
// çıkarım yapar (inferTrack), yazılıysa yazılana uyar.
//
// KURAL: Bir öğrenciyi "şu dersten zayıf" diye değerlendiren ya da ona iş
// atayan hiçbir ekran, ders listesini ham veriden türetmez — buradan alır
// (bkz. lib/subjects.ts'teki aynı kural).
// ----------------------------------------------------------------------------

export type Track = "sayisal" | "esit_agirlik" | "sozel" | "dil";

export const TRACK_LABEL: Record<Track, string> = {
  sayisal: "Sayısal",
  esit_agirlik: "Eşit Ağırlık",
  sozel: "Sözel",
  dil: "Yabancı Dil",
};

/** Alan seçimi bu sınıftan İTİBAREN anlamlıdır (11. sınıfın başı). */
export const TRACK_START_GRADE = 11;

/**
 * TYT — HER alan için ortak. Bir sayısalcıyı da bir sözelciyi de buradan
 * değerlendirmek meşrudur.
 *
 * ⚠️ TYT'de Edebiyat DEĞİL "Türkçe" vardır; AYT'de Türkçe değil "Edebiyat".
 * İkisini karıştırmak, Mert'in şikâyetinin ta kendisiydi.
 */
export const TYT_SUBJECTS = ["Türkçe", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"] as const;

/**
 * AYT — ALANA GÖRE. Bir öğrenci yalnızca kendi alanının AYT derslerinden
 * sorumludur.
 *
 * ⚠️ Din Kültürü AYT'de Sözel ve EA'nın Felsefe Grubu içinde yer alır
 * (tercihe bağlı olarak Din Kültürü ya da ek Felsefe soruları); bu yüzden
 * o iki alanda listede, Sayısal'da DEĞİL.
 */
export const AYT_SUBJECTS_BY_TRACK: Record<Track, string[]> = {
  sayisal: ["Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji"],
  esit_agirlik: ["Matematik", "Geometri", "Edebiyat", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  sozel: ["Edebiyat", "Tarih", "Coğrafya", "Felsefe", "Din Kültürü ve Ahlak Bilgisi"],
  dil: ["İngilizce", "Edebiyat"],
};

/** Ortaokul (5-8) LGS dersleri — alan kavramı YOKTUR. */
export const LGS_SUBJECTS = ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce", "Din Kültürü ve Ahlak Bilgisi"] as const;

/** 9-10. sınıf: alan seçimi henüz yapılmamıştır, müfredat ortaktır. */
export const GRADE_9_10_SUBJECTS = ["Türkçe", "Edebiyat", "Matematik", "Geometri", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya", "Din Kültürü ve Ahlak Bilgisi", "İngilizce"] as const;

/**
 * Şube adı / serbest metinden alanı çıkarır.
 *
 * ⚠️ Neden gerekli: alan alanı (track) pratikte boş ve bilgi ŞUBE ADINDA
 * ("11-A Fen", "12-B Eşit Ağırlık"). Kurum alanı düzgün girmeye başlayınca
 * bu çıkarım kendiliğinden devre dışı kalır — yazılı değer her zaman önce
 * gelir (bkz. resolveTrack).
 */
export function inferTrack(text: string | null | undefined): Track | null {
  if (!text) return null;
  const t = text.toLocaleLowerCase("tr");
  if (/(eşit ağırlık|esit agirlik|\bea\b|\bta\b|türkçe.?mat|turkce.?mat)/.test(t)) return "esit_agirlik";
  if (/(sayısal|sayisal|\bfen\b|\bmf\b|matematik.?fen)/.test(t)) return "sayisal";
  if (/(sözel|sozel|\bsöz\b|edebiyat.?sosyal|\bts\b)/.test(t)) return "sozel";
  if (/(yabancı dil|yabanci dil|\bdil\b|\bydt\b)/.test(t)) return "dil";
  return null;
}

/** Yazılı değer varsa o, yoksa şube/öğrenci adından çıkarım. */
export function resolveTrack(written: string | null | undefined, fallbackText?: string | null): Track | null {
  if (written) {
    const direct = (Object.keys(TRACK_LABEL) as Track[]).find(
      (k) => k === written || TRACK_LABEL[k].toLocaleLowerCase("tr") === written.toLocaleLowerCase("tr")
    );
    if (direct) return direct;
    const inferred = inferTrack(written);
    if (inferred) return inferred;
  }
  return inferTrack(fallbackText);
}

export type ResponsibleSubjects = {
  /** Bu sınıf/alan için sorumlu tutulabilecek TÜM dersler. */
  subjects: string[];
  /** TYT kısmı (lise) ya da LGS kısmı (ortaokul). */
  common: string[];
  /** AYT kısmı — yalnızca 11+ ve alanı belli olanlarda dolu. */
  trackOnly: string[];
  /** Alan bilinmiyorsa ve 11+ ise true — kuruma "alanı gir" demek için. */
  trackMissing: boolean;
  track: Track | null;
};

/**
 * "Bu öğrenci hangi derslerden sorumlu?" — sistemin bu soruya verdiği TEK cevap.
 *
 * Kurallar:
 *   5-8   → LGS dersleri, alan kavramı yok.
 *   9-10  → ortak lise müfredatı; alan seçimi henüz yapılmamıştır.
 *   11+   → TYT (ortak) + kendi alanının AYT dersleri.
 *           Alan bilinmiyorsa SADECE TYT döner ve trackMissing=true olur;
 *           uydurma yapılmaz, eksik olduğu söylenir.
 */
export function responsibleSubjects(
  grade: number | null | undefined,
  track: Track | null
): ResponsibleSubjects {
  if (levelOfGrade(grade) === "ortaokul") {
    return { subjects: [...LGS_SUBJECTS], common: [...LGS_SUBJECTS], trackOnly: [], trackMissing: false, track: null };
  }
  if ((grade ?? 12) < TRACK_START_GRADE) {
    return {
      subjects: [...GRADE_9_10_SUBJECTS],
      common: [...GRADE_9_10_SUBJECTS],
      trackOnly: [],
      trackMissing: false,
      track: null,
    };
  }
  const common = [...TYT_SUBJECTS];
  if (!track) {
    return { subjects: common, common, trackOnly: [], trackMissing: true, track: null };
  }
  const trackOnly = AYT_SUBJECTS_BY_TRACK[track];
  // Birleşim — aynı ders TYT'de de AYT'de de olabilir (ör. Matematik).
  const subjects = [...new Set([...common, ...trackOnly])];
  return { subjects, common, trackOnly, trackMissing: false, track };
}

/** Bir ders bu öğrencinin sorumluluğunda mı? (değerlendirme süzgeci) */
export function isResponsibleFor(grade: number | null | undefined, track: Track | null, subject: string): boolean {
  return responsibleSubjects(grade, track).subjects.includes(subject);
}
