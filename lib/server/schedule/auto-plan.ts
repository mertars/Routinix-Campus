import { responsibleSubjects, resolveTrack, TRACK_LABEL, type Track } from "@/lib/tracks";
import { levelOfGrade } from "@/lib/subjects";

// ----------------------------------------------------------------------------
// OTOMATİK DERS PROGRAMI ÜRETİCİ.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-18): "çakışmasız ders programında otomatik bir
// plan oluşturucu yap ama akıllı çalışsın — 7. sınıf öğrencisine kimya
// vermesin. Ders programı en sürtünmeli yer."
//
// ⚠️ "AKILLI" burada sihir değil, ÜÇ SERT KURAL demek:
//   1. Sınıf yalnızca SORUMLU OLDUĞU dersi alır (bkz. lib/tracks.ts).
//      7. sınıfa Kimya, sayısal 12'ye Edebiyat yazılmaz.
//   2. Dersi verecek öğretmenin BRANŞI tutmak zorunda.
//   3. Bir öğretmen aynı gün+saatte iki şubede olamaz (çakışma).
// Bunların üstüne iki YUMUŞAK tercih: aynı ders aynı güne yığılmasın,
// haftalık saatler derse göre ağırlıklandırılsın.
//
// ⚠️ SAF FONKSİYON — veritabanına dokunmaz, rastgelelik kullanmaz. Böylece
// aynı girdi her zaman aynı planı üretir (yönetici "uygula"ya bastığında
// önizlemede gördüğünden farklı bir şey kaydedilmez) ve test edilebilir.
// ----------------------------------------------------------------------------

export type PlanBranch = { id: string; name: string; grade: number | null; track: string | null };
export type PlanTeacher = { id: string; name: string; subject: string };
export type PlanBlocked = { teacherId: string; day: string; slot: string };

export type PlanAssignment = { branchId: string; day: string; slot: string; teacherId: string; subject: string };

export type BranchReport = {
  branchId: string;
  branchName: string;
  grade: number | null;
  track: Track | null;
  trackLabel: string;
  trackMissing: boolean;
  /** Bu şubenin sorumlu olduğu dersler — yöneticinin denetleyeceği liste. */
  responsible: string[];
  /** Ders → atanan haftalık saat. */
  assigned: Record<string, number>;
  /** Sorumlu olduğu ama kurumda BRANŞ ÖĞRETMENİ OLMAYAN dersler. */
  missingTeacher: string[];
  /**
   * Öğretmeni VAR ama saati yetmediği için hedefin altında kalan dersler.
   *
   * ⚠️ Bu ayrım canlı veriyle ortaya çıktı: Kontrol'de tek Türkçe öğretmeni
   * var ve üst sınıflar onu doldurunca 7-A'ya "Türkçe 0" yazılıyordu. Rapor
   * "öğretmeni yok" mu "öğretmen dolu" mu demeli — ikisi TAMAMEN farklı iki
   * eylem gerektirir (öğretmen alma vs. saat/şube düzeni).
   */
  scarceSubjects: string[];
  emptySlots: number;
};

export type PlanResult = {
  assignments: PlanAssignment[];
  branches: BranchReport[];
  /** Kurum genelinde hiç öğretmeni olmayan dersler. */
  unstaffedSubjects: string[];
  totalSlots: number;
  filledSlots: number;
};

/**
 * Haftalık ders ağırlıkları — hangi ders kaç saat almalı.
 *
 * ⚠️ Bunlar bir MÜFREDAT DAYATMASI değil, boş bir programı makul bir
 * başlangıç noktasına getiren ağırlıklar. Yönetici sonuçtaki her hücreyi
 * elle değiştirebiliyor (ekran zaten sürükle-bırak). Amaç "sıfırdan
 * doldurmak" yükünü kaldırmak.
 */
const WEIGHT: Record<string, number> = {
  Matematik: 5,
  Türkçe: 4,
  Edebiyat: 4,
  "Fen Bilimleri": 4,
  "Sosyal Bilgiler": 3,
  Fizik: 3,
  Kimya: 3,
  Biyoloji: 3,
  Geometri: 2,
  Tarih: 2,
  Coğrafya: 2,
  Felsefe: 1,
  "Din Kültürü ve Ahlak Bilgisi": 1,
  İngilizce: 2,
};

/**
 * Öğretmen branşı ile dersin eşleşmesi.
 *
 * ⚠️ Ortaokulda tek bir "LGS Branş" öğretmeni birden fazla dersi
 * verebiliyor (canlı veride Arslan'da tam olarak böyle: tek LGS öğretmeni).
 * Bu yüzden eşleşme birebir metin değil: LGS Branş, ortaokul derslerinin
 * TAMAMINA girebilir. "Diğer" branşı hiçbir derse otomatik atanmaz —
 * ne olduğu belirsiz bir branşı programa yazmak, yanlış bilgiyi
 * kurumsallaştırmak olurdu.
 */
function canTeach(teacherSubject: string, subject: string, grade: number | null): boolean {
  if (teacherSubject === subject) return true;
  if (teacherSubject === "LGS Branş" && levelOfGrade(grade) === "ortaokul") return true;
  // Geometri öğretmeni yoksa Matematik öğretmeni girer (ve tersi) — ikisi
  // pratikte aynı branştır.
  if ((teacherSubject === "Matematik" && subject === "Geometri") || (teacherSubject === "Geometri" && subject === "Matematik")) {
    return true;
  }
  return false;
}

/** Sıralı, deterministik anahtar — aynı girdi aynı planı üretsin. */
function key(day: string, slot: string): string {
  return `${day}|${slot}`;
}

export function buildAutoPlan(input: {
  branches: PlanBranch[];
  teachers: PlanTeacher[];
  days: readonly string[];
  slots: readonly string[];
  blocked: PlanBlocked[];
  /** Var olan dersler korunacaksa buraya verilir (üzerine yazılmaz). */
  existing?: PlanAssignment[];
}): PlanResult {
  const { branches, teachers, days, slots, blocked } = input;
  const existing = input.existing ?? [];

  const blockedSet = new Set(blocked.map((b) => `${b.teacherId}|${key(b.day, b.slot)}`));
  // Öğretmen meşgul mü (gün+saat) — hem var olan program hem bu turda atananlar.
  const teacherBusy = new Set(existing.map((e) => `${e.teacherId}|${key(e.day, e.slot)}`));
  // Şubenin o hücresi dolu mu.
  const branchTaken = new Set(existing.map((e) => `${e.branchId}|${key(e.day, e.slot)}`));

  const assignments: PlanAssignment[] = [];
  const unstaffed = new Set<string>();

  // ⚠️ HAZIRLIK: her şube için alan, sorumlu dersler, hedef saatler.
  //
  // ⚠️ SIRA DEĞİŞTİ (canlı veriyle bulundu): eskiden şubeler sınıf
  // seviyesine göre TEK TEK doldurulıyordu ve tek Türkçe/LGS öğretmeni
  // olan kurumlarda üst sınıflar öğretmeni tüketince ALT SINIFLAR TAMAMEN
  // BOŞ kalıyordu (Arslan'da 5/6/7. sınıfların üçü de 0 ders aldı). Şimdi
  // hücre hücre, şubeler arasında DÖNÜŞÜMLÜ ilerlenir — kıt öğretmen
  // sınıflara adil dağılır.
  type Prep = {
    branch: PlanBranch;
    track: Track | null;
    info: ReturnType<typeof responsibleSubjects>;
    teachersFor: Map<string, PlanTeacher[]>;
    target: Map<string, number>;
    assigned: Record<string, number>;
    missingTeacher: string[];
    cells: { day: string; slot: string }[];
    placedPerDay: Map<string, Set<string>>;
  };

  const preps: Prep[] = [];
  for (const branch of branches) {
    const track = resolveTrack(branch.track, branch.name);
    const info = responsibleSubjects(branch.grade, track);
    const teachersFor = new Map<string, PlanTeacher[]>();
    const missingTeacher: string[] = [];
    for (const subject of info.subjects) {
      const list = teachers.filter((t) => canTeach(t.subject, subject, branch.grade));
      teachersFor.set(subject, list);
      if (list.length === 0) {
        missingTeacher.push(subject);
        unstaffed.add(subject);
      }
    }
    const cells: { day: string; slot: string }[] = [];
    for (const day of days) {
      for (const slot of slots) {
        if (!branchTaken.has(`${branch.id}|${key(day, slot)}`)) cells.push({ day, slot });
      }
    }
    const teachable = info.subjects.filter((s) => (teachersFor.get(s) ?? []).length > 0);

    // ⚠️ ALANA GÖRE AĞIRLIK: TYT hepsinde ortaktır, yani EA öğrencisi de
    // TYT Biyoloji'den sorumludur — ama AYT'sinde Biyoloji YOKTUR. İkisine
    // aynı saati vermek EA sınıfını sayısal gibi çalıştırmak olurdu.
    const TYT_ONLY_FACTOR = 0.4;
    const weightOf = (subject: string): number => {
      const base = WEIGHT[subject] ?? 1;
      if (info.trackOnly.length === 0) return base; // ortaokul / 9-10: ayrım yok
      return info.trackOnly.includes(subject) ? base : base * TYT_ONLY_FACTOR;
    };
    const totalWeight = teachable.reduce((sum, x) => sum + weightOf(x), 0);
    const target = new Map<string, number>();
    for (const x of teachable) {
      target.set(x, totalWeight > 0 ? Math.max(1, Math.round((cells.length * weightOf(x)) / totalWeight)) : 0);
    }

    preps.push({ branch, track, info, teachersFor, target, assigned: {}, missingTeacher, cells, placedPerDay: new Map() });
  }

  // Öğretmen yükü — dengeli dağıtım için tek yerde tutulur.
  const load = new Map<string, number>();
  for (const a of existing) load.set(a.teacherId, (load.get(a.teacherId) ?? 0) + 1);

  // Dönüşümlü yerleştirme: her tur, her şubeye BİR hücre. Şube sırası
  // turdan tura kaydırılır (round-robin) — ilk şube her turda öne geçmesin.
  const maxCells = Math.max(0, ...preps.map((p) => p.cells.length));
  for (let round = 0; round < maxCells; round++) {
    for (let i = 0; i < preps.length; i++) {
      const prep = preps[(i + round) % preps.length];
      const cell = prep.cells[round];
      if (!cell) continue;
      const dayUsed = prep.placedPerDay.get(cell.day) ?? new Set<string>();
      const teachable = [...prep.target.keys()];

      const candidates = teachable
        .map((subject) => ({
          subject,
          need: (prep.target.get(subject) ?? 0) - (prep.assigned[subject] ?? 0),
          sameDayPenalty: dayUsed.has(subject) ? 1 : 0,
        }))
        .filter((c) => c.need > 0)
        .sort((a, b) => a.sameDayPenalty - b.sameDayPenalty || b.need - a.need || a.subject.localeCompare(b.subject, "tr"));

      for (const candidate of candidates) {
        const pool = prep.teachersFor.get(candidate.subject) ?? [];
        const teacher = [...pool]
          .sort((x, y) => (load.get(x.id) ?? 0) - (load.get(y.id) ?? 0) || x.name.localeCompare(y.name, "tr"))
          .find(
            (t) =>
              !teacherBusy.has(`${t.id}|${key(cell.day, cell.slot)}`) &&
              !blockedSet.has(`${t.id}|${key(cell.day, cell.slot)}`)
          );
        if (!teacher) continue;
        assignments.push({
          branchId: prep.branch.id,
          day: cell.day,
          slot: cell.slot,
          teacherId: teacher.id,
          subject: candidate.subject,
        });
        teacherBusy.add(`${teacher.id}|${key(cell.day, cell.slot)}`);
        branchTaken.add(`${prep.branch.id}|${key(cell.day, cell.slot)}`);
        load.set(teacher.id, (load.get(teacher.id) ?? 0) + 1);
        prep.assigned[candidate.subject] = (prep.assigned[candidate.subject] ?? 0) + 1;
        dayUsed.add(candidate.subject);
        prep.placedPerDay.set(cell.day, dayUsed);
        break;
      }
      // Hücre boş kalabilir: uygun öğretmen yoksa BOŞ BIRAKILIR. Yanlış
      // branşla doldurmak programı kullanılamaz hale getirirdi.
    }
  }

  const reports: BranchReport[] = preps.map((prep) => {
    const filled = Object.values(prep.assigned).reduce((a, b) => a + b, 0);
    // Öğretmeni var ama hedefin ALTINDA kalan dersler — kıtlık.
    const scarceSubjects = [...prep.target.keys()]
      .filter((s) => (prep.assigned[s] ?? 0) < (prep.target.get(s) ?? 0))
      .sort((a, b) => a.localeCompare(b, "tr"));
    return {
      branchId: prep.branch.id,
      branchName: prep.branch.name,
      grade: prep.branch.grade,
      track: prep.track,
      trackLabel: prep.track ? TRACK_LABEL[prep.track] : prep.info.trackMissing ? "ALAN GİRİLMEMİŞ" : "—",
      trackMissing: prep.info.trackMissing,
      responsible: prep.info.subjects,
      assigned: prep.assigned,
      missingTeacher: prep.missingTeacher,
      scarceSubjects,
      emptySlots: prep.cells.length - filled,
    };
  });

  const totalSlots = branches.length * days.length * slots.length;
  return {
    assignments,
    branches: reports.sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.branchName.localeCompare(b.branchName, "tr")),
    unstaffedSubjects: [...unstaffed].sort((a, b) => a.localeCompare(b, "tr")),
    totalSlots,
    filledSlots: existing.length + assignments.length,
  };
}
