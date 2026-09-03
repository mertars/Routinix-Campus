// Video Ders Merkezi'nin ders listesi — Akademik Röntgen'in CURRICULUM_TREE'si
// (lib/mock-data.ts) SADECE Matematik için konu/alt konu kırılımı içeriyor;
// video kütüphanesi ise TÜM dersleri ve TÜM sınıf seviyelerini (1-12)
// kapsamalı (röntgen SADECE lise 9-12 ile sınırlı, bkz. XRAY_MIN_GRADE —
// video merkezi için aynı kısıtı koymadık). Bu yüzden ayrı, sade bir ders
// listesi + her ders için tutarlı bir renk tonu (UI'da grup başlıkları için).
export const VIDEO_SUBJECTS = [
  "Matematik",
  "Fizik",
  "Kimya",
  "Biyoloji",
  "Türkçe",
  "Türk Dili ve Edebiyatı",
  "Tarih",
  "Coğrafya",
  "Felsefe",
  "İngilizce",
  "Din Kültürü ve Ahlak Bilgisi",
] as const;

export type VideoSubject = (typeof VIDEO_SUBJECTS)[number];

export const SUBJECT_TONE: Record<string, { text: string; bg: string; dot: string }> = {
  Matematik: { text: "text-sky-700 dark:text-sky-300", bg: "bg-sky-500/10", dot: "bg-sky-500" },
  Fizik: { text: "text-violet-700 dark:text-violet-300", bg: "bg-violet-500/10", dot: "bg-violet-500" },
  Kimya: { text: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  Biyoloji: { text: "text-teal-700 dark:text-teal-300", bg: "bg-teal-500/10", dot: "bg-teal-500" },
  Türkçe: { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  "Türk Dili ve Edebiyatı": { text: "text-amber-700 dark:text-amber-300", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  Tarih: { text: "text-rose-700 dark:text-rose-300", bg: "bg-rose-500/10", dot: "bg-rose-500" },
  Coğrafya: { text: "text-lime-700 dark:text-lime-300", bg: "bg-lime-500/10", dot: "bg-lime-500" },
  Felsefe: { text: "text-fuchsia-700 dark:text-fuchsia-300", bg: "bg-fuchsia-500/10", dot: "bg-fuchsia-500" },
  İngilizce: { text: "text-indigo-700 dark:text-indigo-300", bg: "bg-indigo-500/10", dot: "bg-indigo-500" },
  "Din Kültürü ve Ahlak Bilgisi": { text: "text-cyan-700 dark:text-cyan-300", bg: "bg-cyan-500/10", dot: "bg-cyan-500" },
};

export const DEFAULT_SUBJECT_TONE = { text: "text-espresso dark:text-cream", bg: "bg-cream-muted dark:bg-white/10", dot: "bg-espresso-muted" };

export function subjectTone(subject: string) {
  return SUBJECT_TONE[subject] ?? DEFAULT_SUBJECT_TONE;
}
