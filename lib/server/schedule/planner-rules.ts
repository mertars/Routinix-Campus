// ----------------------------------------------------------------------------
// DERS PROGRAMI KURALLARI — kaynak kaydı (source registry).
//
// ⚠️ NEDEN VAR (Mert, 2026-09-18): "otomatik hazırlamadan önce kurallar
// koyabilsin; öğretmenin çalışmadığı gün var mı, ağırlık vermek istediğiniz
// ders var mı gibi 5-10 tane çok güzel kural seçeneği hazırla. Ayrıca
// sadece çakışmasız değil: sınıfın ortalamasına göre, devamsızlıklara göre,
// hocanın performansına göre — en çok devamsızlık olan sınıfa devam oranı
// en yüksek hoca koymak gibi."
//
// ⚠️ TASARIM: kurallar SERT KISIT değil, PUANLAMA ağırlığıdır (biri hariç:
// öğretmenin izinli günü serttir). Sebebi pratik — 12 şube × 20 saat ×
// kısıtlı öğretmen kadrosunda sert kuralların hepsini aynı anda sağlamak
// çoğu zaman İMKÂNSIZDIR ve plan tamamen boş çıkar. Puanlama ise "elinden
// geldiğince uy" demektir: program yine dolar, kurallara uyum raporda
// yüzde olarak görünür.
//
// Yeni bir kural eklemek = bu diziye BİR GİRDİ + planlayıcıda tek bir
// puan satırı. Ekranda kendiliğinden görünür.
// ----------------------------------------------------------------------------

export type RuleId =
  | "teacherDaysOff"
  | "subjectEmphasis"
  | "maxSameSubjectPerDay"
  | "preferDoubleBlocks"
  | "maxDailyLoadPerTeacher"
  | "heavySubjectsEarly"
  | "minimizeTeacherGaps"
  | "strongTeacherToWeakBranch"
  | "disciplinedTeacherToAbsentBranch"
  | "pinTeacherToBranch"
  | "banTeacherFromBranch";

export type PlannerRules = {
  /** Öğretmenin hiç çalışmadığı günler — SERT kısıt. */
  teacherDaysOff?: { teacherId: string; days: string[] }[];
  /** Belirli şubede belirli derse ekstra ağırlık (1 = normal, 2 = iki katı). */
  subjectEmphasis?: { branchId: string; subject: string; factor: number }[];
  /** Günde aynı dersten en fazla kaç saat. */
  maxSameSubjectPerDay?: number;
  /** Aynı dersi ardışık iki saat (blok ders) tercih et. */
  preferDoubleBlocks?: boolean;
  /** Bir öğretmenin bir günde girebileceği azami ders. */
  maxDailyLoadPerTeacher?: number;
  /** Sayısal ağırlıklı dersleri günün erken saatlerine yerleştir. */
  heavySubjectsEarly?: boolean;
  /** Öğretmenin günü delik deşik olmasın (boş saat arası azalt). */
  minimizeTeacherGaps?: boolean;
  /** Net ortalaması düşük şubeye, performansı yüksek öğretmeni yönlendir. */
  strongTeacherToWeakBranch?: boolean;
  /** Devamsızlığı yüksek şubeye, devam disiplini yüksek öğretmeni yönlendir. */
  disciplinedTeacherToAbsentBranch?: boolean;
  /** Şu öğretmen mutlaka şu şubeye girsin. */
  pinTeacherToBranch?: { teacherId: string; branchId: string }[];
  /** Şu öğretmen şu şubeye GİRMESİN — SERT kısıt. */
  banTeacherFromBranch?: { teacherId: string; branchId: string }[];
};

/** Ekranda gösterilecek kural kataloğu — açıklamalar kullanıcı diliyle. */
export const RULE_CATALOG: {
  id: RuleId;
  label: string;
  description: string;
  kind: "toggle" | "number" | "list";
  /** Sert kısıt mı (sağlanamazsa hücre boş kalır) yoksa tercih mi. */
  hard: boolean;
  defaultValue?: number;
}[] = [
  {
    id: "teacherDaysOff",
    label: "Öğretmenin çalışmadığı günler",
    description: "Seçilen öğretmen o günlerde hiç ders almaz. Kesin kuraldır.",
    kind: "list",
    hard: true,
  },
  {
    id: "banTeacherFromBranch",
    label: "Öğretmen şu şubeye girmesin",
    description: "Belirli bir öğretmen–şube eşleşmesini tamamen kapatır. Kesin kuraldır.",
    kind: "list",
    hard: true,
  },
  {
    id: "pinTeacherToBranch",
    label: "Öğretmeni şubeye sabitle",
    description: "O şubenin dersleri öncelikle seçtiğiniz öğretmene verilir.",
    kind: "list",
    hard: false,
  },
  {
    id: "subjectEmphasis",
    label: "Şubeye özel ders ağırlığı",
    description: "Örn. 12-A'ya Matematik saatini iki katına çıkar.",
    kind: "list",
    hard: false,
  },
  {
    id: "maxSameSubjectPerDay",
    label: "Günde aynı dersten en fazla",
    description: "Bir sınıf aynı gün aynı dersi bu sayıdan fazla görmez.",
    kind: "number",
    hard: true,
    defaultValue: 2,
  },
  {
    id: "maxDailyLoadPerTeacher",
    label: "Öğretmen günlük azami ders",
    description: "Bir öğretmen bir günde bu sayıdan fazla derse girmez.",
    kind: "number",
    hard: true,
    defaultValue: 6,
  },
  {
    id: "preferDoubleBlocks",
    label: "Blok ders (ardışık iki saat)",
    description: "Aynı dersi mümkün olduğunca peş peşe iki saat yerleştirir.",
    kind: "toggle",
    hard: false,
  },
  {
    id: "heavySubjectsEarly",
    label: "Ağır dersler erken saatlere",
    description: "Matematik, Fizik gibi yoğun dersleri günün ilk saatlerine yaklaştırır.",
    kind: "toggle",
    hard: false,
  },
  {
    id: "minimizeTeacherGaps",
    label: "Öğretmen boşluklarını azalt",
    description: "Öğretmenin günü delik deşik olmasın; dersleri bitişik olsun.",
    kind: "toggle",
    hard: false,
  },
  {
    id: "disciplinedTeacherToAbsentBranch",
    label: "Devamsız sınıfa devam disiplini yüksek öğretmen",
    description:
      "Devamsızlığı en yüksek şubelere, yoklamayı en düzenli tutan öğretmenleri yönlendirir. Gerçek yoklama verisinden hesaplanır.",
    kind: "toggle",
    hard: false,
  },
  {
    id: "strongTeacherToWeakBranch",
    label: "Net ortalaması düşük sınıfa güçlü öğretmen",
    description:
      "Deneme net ortalaması en düşük şubelere, öğrenci netleri en yüksek olan öğretmenleri yönlendirir.",
    kind: "toggle",
    hard: false,
  },
];

/**
 * Veriden gelen sinyaller — kural motorunun "akıllı" kısmı bunlara dayanır.
 * Hepsi 0-1 arasında normalize edilir ki puanlar karşılaştırılabilir olsun.
 */
export type PlannerSignals = {
  /** Şube → devamsızlık şiddeti (1 = en kötü devam). */
  branchAbsenceSeverity: Record<string, number>;
  /** Şube → akademik zayıflık (1 = en düşük net ortalaması). */
  branchAcademicWeakness: Record<string, number>;
  /** Öğretmen → devam disiplini (1 = yoklamayı en düzenli tutan). */
  teacherAttendanceDiscipline: Record<string, number>;
  /** Öğretmen → akademik güç (1 = öğrencilerinin netleri en yüksek). */
  teacherAcademicStrength: Record<string, number>;
};

export const EMPTY_SIGNALS: PlannerSignals = {
  branchAbsenceSeverity: {},
  branchAcademicWeakness: {},
  teacherAttendanceDiscipline: {},
  teacherAcademicStrength: {},
};

/** 0-1 aralığına normalize eder; tüm değerler eşitse hepsi 0 döner. */
export function normalize(values: Map<string, number>, invert = false): Record<string, number> {
  const nums = [...values.values()];
  if (nums.length === 0) return {};
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min;
  const out: Record<string, number> = {};
  for (const [k, v] of values) {
    const scaled = span === 0 ? 0 : (v - min) / span;
    out[k] = invert ? 1 - scaled : scaled;
  }
  return out;
}
