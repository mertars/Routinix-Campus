import { responsibleSubjects, resolveTrack, TRACK_LABEL, type Track } from "@/lib/tracks";
import { levelOfGrade } from "@/lib/subjects";
import { EMPTY_SIGNALS, type PlannerRules, type PlannerSignals } from "@/lib/server/schedule/planner-rules";

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

export type RuleCompliance = {
  /** Kuralın adı ve ne kadarına uyulabildiği (0-1). Rapor için. */
  ruleId: string;
  satisfied: number;
  total: number;
  /** İnsan diliyle ölçüm — yüzde yanıltıcı olduğunda kullanılır. */
  detail?: string;
};

export type PlanResult = {
  assignments: PlanAssignment[];
  /** Kurallara uyum dökümü — "elinden geldiğince uydu" iddiasının kanıtı. */
  compliance: RuleCompliance[];
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

/** "Ağır" sayılan dersler — heavySubjectsEarly kuralı bunlara bakar. */
const HEAVY_SUBJECTS = new Set(["Matematik", "Fizik", "Kimya", "Geometri", "Fen Bilimleri"]);

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
  /** Yöneticinin seçtiği kurallar — hepsi opsiyonel. */
  rules?: PlannerRules;
  /** Veriden gelen sinyaller (devamsızlık, net, öğretmen performansı). */
  signals?: PlannerSignals;
}): PlanResult {
  const { branches, teachers, days, slots, blocked } = input;
  const existing = input.existing ?? [];
  const rules: PlannerRules = input.rules ?? {};
  const signals: PlannerSignals = input.signals ?? EMPTY_SIGNALS;

  // SERT kısıtlar — sağlanamazsa hücre boş kalır.
  const daysOff = new Set(
    (rules.teacherDaysOff ?? []).flatMap((r) => r.days.map((d) => `${r.teacherId}|${d}`))
  );
  const bannedPairs = new Set((rules.banTeacherFromBranch ?? []).map((r) => `${r.teacherId}|${r.branchId}`));
  const pinnedPairs = new Set((rules.pinTeacherToBranch ?? []).map((r) => `${r.teacherId}|${r.branchId}`));
  const emphasis = new Map(
    (rules.subjectEmphasis ?? []).map((r) => [`${r.branchId}|${r.subject}`, Math.max(0.1, r.factor)])
  );
  const maxSameSubjectPerDay = rules.maxSameSubjectPerDay ?? Infinity;
  const maxDailyLoad = rules.maxDailyLoadPerTeacher ?? Infinity;

  // Öğretmenin gün içi ders sayısı ve dolu saatleri (günlük yük + boşluk).
  const teacherDayLoad = new Map<string, number>();
  const teacherDaySlots = new Map<string, Set<number>>();
  for (const a of existing) {
    const dk = `${a.teacherId}|${a.day}`;
    teacherDayLoad.set(dk, (teacherDayLoad.get(dk) ?? 0) + 1);
    const idx = slots.indexOf(a.slot);
    if (idx >= 0) {
      const set = teacherDaySlots.get(dk) ?? new Set<number>();
      set.add(idx);
      teacherDaySlots.set(dk, set);
    }
  }

  const complianceCounters = new Map<string, { satisfied: number; total: number }>();
  const note = (ruleId: string, ok: boolean) => {
    const c = complianceCounters.get(ruleId) ?? { satisfied: 0, total: 0 };
    c.total += 1;
    if (ok) c.satisfied += 1;
    complianceCounters.set(ruleId, c);
  };

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
    /** Gün → ders → o gün kaç saat kondu (maxSameSubjectPerDay için). */
    perDayCount: Map<string, Map<string, number>>;
    /** Gün → en son konan ders (blok ders için). */
    lastPlaced: Map<string, string>;
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
    // ⚠️ HÜCRE SIRASI KURALA GÖRE DEĞİŞİR (ölçümle bulundu).
    //
    // Varsayılan sıra GÜN önceliklidir (Pzt 1-2-3-4, Salı 1-2-3-4...).
    // "Ağır dersler erken saatlere" kuralı bu sırada İŞE YARAMIYORDU:
    // ölçüldü — ağır dersler ort. 2.5. saat, diğerleri 2.6. saat, yani fark
    // yok. Sebep yapısal: haftanın ilerleyen günlerinde ağır derslerin
    // "ihtiyacı" tükeniyor ve o günlerin ilk saatleri hafif derslere
    // kalıyor. Puan ağırlığını artırmak (7 → 15 → 25) hiçbir şeyi
    // değiştirmedi; sorun puanda değil SIRADAYDI.
    //
    // Kural açıkken sıra SAAT öncelikli olur: haftanın TÜM 1. saatleri
    // önce dolar, sonra tüm 2. saatler... Böylece ağır dersler gerçekten
    // erken saatleri kapar. Kural kapalıyken davranış aynen korunur.
    const cells: { day: string; slot: string }[] = [];
    if (rules.heavySubjectsEarly) {
      // ⚠️ SON SAATLER ÖNCE DOLDURULUR — bu ters görünen sıra, ölçümle
      // bulunan bir hatanın düzeltmesi:
      //
      // Önce "tüm 1. saatler, sonra 2. saatler..." denendi. Sonuç kuralı
      // TERSİNE ÇEVİRDİ: son saatte ağır ders oranı %49'dan %58'e çıktı.
      // Sebep aritmetik — bir fen sınıfında hafif ders toplamı (~4 saat)
      // son saat sayısından (5 gün) AZ. Hafif dersler erken saatlerde
      // tükenince son saatte seçenek olarak yalnızca ağır dersler kalıyor.
      //
      // Doğru strateji REZERVASYON: son saat hücreleri İLK sırada
      // işlenir, orada ağır ders cezalı olduğu için kıt olan hafif
      // dersler oraya yerleşir; kalan saatler ağır derslere kalır.
      const lastSlot = slots[slots.length - 1];
      for (const slot of [lastSlot, ...slots.filter((s) => s !== lastSlot)]) {
        for (const day of days) {
          if (!branchTaken.has(`${branch.id}|${key(day, slot)}`)) cells.push({ day, slot });
        }
      }
    } else {
      for (const day of days) {
        for (const slot of slots) {
          if (!branchTaken.has(`${branch.id}|${key(day, slot)}`)) cells.push({ day, slot });
        }
      }
    }
    const teachable = info.subjects.filter((s) => (teachersFor.get(s) ?? []).length > 0);

    // ⚠️ ALANA GÖRE AĞIRLIK: TYT hepsinde ortaktır, yani EA öğrencisi de
    // TYT Biyoloji'den sorumludur — ama AYT'sinde Biyoloji YOKTUR. İkisine
    // aynı saati vermek EA sınıfını sayısal gibi çalıştırmak olurdu.
    const TYT_ONLY_FACTOR = 0.4;
    const weightOf = (subject: string): number => {
      const base = WEIGHT[subject] ?? 1;
      // Yöneticinin şubeye özel ağırlık kuralı (örn. 12-A'ya Matematik x2).
      //
      // ⚠️ GERÇEK HATA: bu satır eskiden alan kontrolünden SONRA geliyordu
      // ve ortaokul / 9-10. sınıf için fonksiyon `return base` ile erken
      // çıkıyordu — yani yöneticinin ders ağırlığı kuralı o sınıflarda
      // SESSİZCE HİÇBİR ŞEY YAPMIYORDU. Kural artık her kademede geçerli.
      const manual = emphasis.get(`${branch.id}|${subject}`) ?? 1;
      // Alan ayrımı yalnızca 11+ için anlamlı (ortaokul/9-10'da trackOnly boş).
      const trackFactor =
        info.trackOnly.length === 0 ? 1 : info.trackOnly.includes(subject) ? 1 : TYT_ONLY_FACTOR;
      return base * trackFactor * manual;
    };
    const totalWeight = teachable.reduce((sum, x) => sum + weightOf(x), 0);
    const target = new Map<string, number>();
    for (const x of teachable) {
      target.set(x, totalWeight > 0 ? Math.max(1, Math.round((cells.length * weightOf(x)) / totalWeight)) : 0);
    }

    preps.push({
      branch,
      track,
      info,
      teachersFor,
      target,
      assigned: {},
      missingTeacher,
      cells,
      placedPerDay: new Map(),
      perDayCount: new Map(),
      lastPlaced: new Map(),
    });
  }

  // Öğretmen yükü — dengeli dağıtım için tek yerde tutulur.
  const load = new Map<string, number>();
  for (const a of existing) load.set(a.teacherId, (load.get(a.teacherId) ?? 0) + 1);

  // ⚠️ İHTİYAÇ SIRASI (testte ortaya çıktı): "en çok devamsızlık olan
  // sınıfa devam oranı en yüksek hoca" kuralı tek başına YETMİYOR. İki
  // şube aynı turda aynı öğretmen için yarışınca, sırası önce gelen
  // kapıyor ve sorunlu şube ancak yarı yarıya kazanıyordu. Kural açıkken
  // İHTİYACI YÜKSEK ŞUBE turda ÖNCE seçim yapar — "öncelik" kelimesinin
  // gerçek karşılığı budur.
  const priority = new Map<string, number>();
  for (const prep of preps) {
    let p = 0;
    if (rules.disciplinedTeacherToAbsentBranch) p += signals.branchAbsenceSeverity[prep.branch.id] ?? 0;
    if (rules.strongTeacherToWeakBranch) p += signals.branchAcademicWeakness[prep.branch.id] ?? 0;
    priority.set(prep.branch.id, p);
  }
  const hasPriority = [...priority.values()].some((v) => v > 0);
  if (hasPriority) {
    preps.sort((a, b) => (priority.get(b.branch.id) ?? 0) - (priority.get(a.branch.id) ?? 0));
  }

  // Dönüşümlü yerleştirme: her tur, her şubeye BİR hücre. Öncelik yoksa
  // şube sırası turdan tura kaydırılır (round-robin) — ilk şube her turda
  // öne geçmesin. Öncelik varsa sıra SABİT kalır, ihtiyaç sahibi hep önde.
  const maxCells = Math.max(0, ...preps.map((p) => p.cells.length));
  for (let round = 0; round < maxCells; round++) {
    for (let i = 0; i < preps.length; i++) {
      const prep = preps[hasPriority ? i : (i + round) % preps.length];
      const cell = prep.cells[round];
      if (!cell) continue;
      const dayUsed = prep.placedPerDay.get(cell.day) ?? new Set<string>();
      const teachable = [...prep.target.keys()];

      const slotIndex = slots.indexOf(cell.slot);
      const dayCount = prep.perDayCount.get(cell.day) ?? new Map<string, number>();
      const prevSubject = prep.lastPlaced.get(cell.day);

      // DERS PUANI — kurallar buradan devreye girer. Yüksek puan önce denenir.
      const candidates = teachable
        .map((subject) => {
          const need = (prep.target.get(subject) ?? 0) - (prep.assigned[subject] ?? 0);
          let score = need * 10;

          // Aynı gün tekrarı: sert sınır aşılıyorsa aday elenir.
          const sameDay = dayCount.get(subject) ?? 0;
          if (sameDay >= maxSameSubjectPerDay) return { subject, need, score: -Infinity };
          score -= sameDay * 6;

          // ⚠️ AĞIRLIKLAR ÖLÇÜLEREK AYARLANDI (canlı planla): ilk değerler
          // (+12 ve ±2) `need * 10` teriminin yanında eriyip gidiyordu —
          // uyum raporu blok derste %21, ağır derste %51 (yani rastgeleyle
          // aynı) çıkıyordu. Bir kuralın açık olması ile kapalı olması
          // arasında ölçülebilir bir fark yoksa o kural yalan söylüyor
          // demektir.
          if (rules.preferDoubleBlocks && prevSubject === subject && sameDay < maxSameSubjectPerDay) score += 25;

          // ⚠️ KURAL YENİDEN TANIMLANDI (iki kez ölçüldükten sonra).
          //
          // İlk hâli "ağır dersler günün ilk yarısına" idi ve ÖLÇÜLEBİLİR
          // BİR ETKİSİ YOKTU: ağır dersler ort. 2.5. saat, diğerleri 2.5.
          // saat. Ne puan ağırlığı (7→15→25) ne de hücre sırasını saat
          // öncelikli yapmak bunu değiştirdi. Sebep yapısal: bir fen
          // sınıfında 20 saatin ~16'sı zaten ağır ders (Mat 5, Fizik 3,
          // Kimya 3, Biyo 3, Geometri 2) — hepsinin ilk yarıya sığması
          // matematiksel olarak imkânsız, ortalama kaçınılmaz biçimde eşit
          // çıkıyor.
          //
          // Yöneticinin ASIL niyeti "matematiği akşam 19:00'a koyma" —
          // yani SON SAATTEN KAÇIN. Bu hem uygulanabilir hem ölçülebilir.
          if (rules.heavySubjectsEarly && HEAVY_SUBJECTS.has(subject)) {
            if (slotIndex === slots.length - 1) score -= 60;
            else if (slotIndex === 0) score += 10;
          }
          return { subject, need, score };
        })
        .filter((c) => c.need > 0 && c.score > -Infinity)
        .sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject, "tr"));

      for (const candidate of candidates) {
        const pool = prep.teachersFor.get(candidate.subject) ?? [];
        // ÖĞRETMEN PUANI — veri sinyalleri ve eşleştirme kuralları burada.
        const scored = pool
          .filter((t) => {
            if (teacherBusy.has(`${t.id}|${key(cell.day, cell.slot)}`)) return false;
            if (blockedSet.has(`${t.id}|${key(cell.day, cell.slot)}`)) return false;
            if (daysOff.has(`${t.id}|${cell.day}`)) return false;
            if (bannedPairs.has(`${t.id}|${prep.branch.id}`)) return false;
            if ((teacherDayLoad.get(`${t.id}|${cell.day}`) ?? 0) >= maxDailyLoad) return false;
            return true;
          })
          .map((t) => {
            // Yük dengesi her zaman temel: az ders almış öğretmen önce.
            let score = -(load.get(t.id) ?? 0) * 3;

            if (pinnedPairs.has(`${t.id}|${prep.branch.id}`)) score += 40;

            // ⚠️ MERT'İN ÖRNEĞİ: "en çok devamsızlık olan sınıfa devam oranı
            // en yüksek hoca". İki sinyalin ÇARPIMI kullanılır: şube ne kadar
            // sorunluysa ve öğretmen ne kadar disiplinliyse ödül o kadar
            // büyür. Toplama olsaydı disiplinli öğretmen sorunsuz şubelere de
            // aynı çekimle giderdi.
            if (rules.disciplinedTeacherToAbsentBranch) {
              const severity = signals.branchAbsenceSeverity[prep.branch.id] ?? 0;
              const discipline = signals.teacherAttendanceDiscipline[t.id] ?? 0;
              score += severity * discipline * 25;
            }
            if (rules.strongTeacherToWeakBranch) {
              const weakness = signals.branchAcademicWeakness[prep.branch.id] ?? 0;
              const strength = signals.teacherAcademicStrength[t.id] ?? 0;
              score += weakness * strength * 25;
            }

            // Boşluk azaltma: öğretmenin o gün zaten dolu saatlerine
            // KOMŞU bir saat ödüllendirilir.
            if (rules.minimizeTeacherGaps) {
              const daySlots = teacherDaySlots.get(`${t.id}|${cell.day}`);
              if (daySlots && daySlots.size > 0) {
                const adjacent = daySlots.has(slotIndex - 1) || daySlots.has(slotIndex + 1);
                score += adjacent ? 8 : -4;
              }
            }
            return { teacher: t, score };
          })
          .sort((a, b) => b.score - a.score || a.teacher.name.localeCompare(b.teacher.name, "tr"));

        const teacher = scored[0]?.teacher;
        if (!teacher) continue;

        // Kural uyum sayacı — raporda yüzde olarak gösterilir.
        if (rules.preferDoubleBlocks) note("preferDoubleBlocks", prevSubject === candidate.subject);
        if (rules.minimizeTeacherGaps) {
          const daySlots = teacherDaySlots.get(`${teacher.id}|${cell.day}`);
          note("minimizeTeacherGaps", !daySlots || daySlots.size === 0 || daySlots.has(slotIndex - 1) || daySlots.has(slotIndex + 1));
        }
        if (rules.disciplinedTeacherToAbsentBranch) {
          const severity = signals.branchAbsenceSeverity[prep.branch.id] ?? 0;
          note("disciplinedTeacherToAbsentBranch", severity < 0.5 || (signals.teacherAttendanceDiscipline[teacher.id] ?? 0) >= 0.5);
        }
        if (rules.strongTeacherToWeakBranch) {
          const weakness = signals.branchAcademicWeakness[prep.branch.id] ?? 0;
          note("strongTeacherToWeakBranch", weakness < 0.5 || (signals.teacherAcademicStrength[teacher.id] ?? 0) >= 0.5);
        }
        if (rules.pinTeacherToBranch?.some((r) => r.branchId === prep.branch.id)) {
          note("pinTeacherToBranch", pinnedPairs.has(`${teacher.id}|${prep.branch.id}`));
        }
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
        dayCount.set(candidate.subject, (dayCount.get(candidate.subject) ?? 0) + 1);
        prep.perDayCount.set(cell.day, dayCount);
        prep.lastPlaced.set(cell.day, candidate.subject);
        const dk = `${teacher.id}|${cell.day}`;
        teacherDayLoad.set(dk, (teacherDayLoad.get(dk) ?? 0) + 1);
        const tds = teacherDaySlots.get(dk) ?? new Set<number>();
        tds.add(slotIndex);
        teacherDaySlots.set(dk, tds);
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
  const compliance: RuleCompliance[] = [...complianceCounters.entries()].map(([ruleId, c]) => ({ ruleId, ...c }));

  // ⚠️ ÖLÇÜT SON SAATE BAKAR, ORTALAMAYA DEĞİL.
  //
  // "Ağır dersler ortalama kaçıncı saatte" ölçütü bu veride HER ZAMAN 1:1
  // çıkıyordu (2.5 / 2.5) çünkü fen sınıfında derslerin çoğu zaten ağır —
  // ortalama kaçınılmaz olarak eşitlenir. Kuralın gerçek karşılığı "son
  // saate ağır ders koyma"; ölçüt de onu ölçmeli. Payda son saatteki TÜM
  // dersler, pay ise ağır OLMAYANLAR: yüzde yükseldikçe kural tutmuş olur.
  if (rules.heavySubjectsEarly && slots.length > 1) {
    const lastSlot = slots[slots.length - 1];
    const lastSlotLessons = assignments.filter((a) => a.slot === lastSlot);
    if (lastSlotLessons.length > 0) {
      const light = lastSlotLessons.filter((a) => !HEAVY_SUBJECTS.has(a.subject)).length;
      compliance.push({
        ruleId: "heavySubjectsEarly",
        satisfied: light,
        total: lastSlotLessons.length,
        detail: `son saatte ${lastSlotLessons.length - light}/${lastSlotLessons.length} ders ağır`,
      });
    }
  }

  return {
    assignments,
    compliance,
    branches: reports.sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.branchName.localeCompare(b.branchName, "tr")),
    unstaffedSubjects: [...unstaffed].sort((a, b) => a.localeCompare(b, "tr")),
    totalSlots,
    filledSlots: existing.length + assignments.length,
  };
}
