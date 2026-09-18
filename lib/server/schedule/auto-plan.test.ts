import { describe, expect, it } from "vitest";
import { buildAutoPlan, type PlanBranch, type PlanTeacher } from "./auto-plan";

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"] as const;
const SLOTS = ["16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"] as const;

const teachers: PlanTeacher[] = [
  { id: "t-mat", name: "Mat Hoca", subject: "Matematik" },
  { id: "t-fiz", name: "Fizik Hoca", subject: "Fizik" },
  { id: "t-kim", name: "Kimya Hoca", subject: "Kimya" },
  { id: "t-bio", name: "Biyo Hoca", subject: "Biyoloji" },
  { id: "t-tur", name: "Türkçe Hoca", subject: "Türkçe" },
  { id: "t-edb", name: "Edebiyat Hoca", subject: "Edebiyat" },
  { id: "t-tar", name: "Tarih Hoca", subject: "Tarih" },
  { id: "t-cog", name: "Coğrafya Hoca", subject: "Coğrafya" },
  { id: "t-lgs", name: "LGS Hoca", subject: "LGS Branş" },
];

function plan(branches: PlanBranch[], extra?: Partial<Parameters<typeof buildAutoPlan>[0]>) {
  return buildAutoPlan({ branches, teachers, days: DAYS, slots: SLOTS, blocked: [], ...extra });
}

describe("otomatik ders programı", () => {
  it("7. sınıfa KİMYA yazmaz (Mert'in şartı)", () => {
    const r = plan([{ id: "b7", name: "7-A", grade: 7, track: null }]);
    const subjects = new Set(r.assignments.map((a) => a.subject));
    expect(subjects.has("Kimya")).toBe(false);
    expect(subjects.has("Fizik")).toBe(false);
    expect(subjects.has("Fen Bilimleri")).toBe(true);
  });

  it("sayısal 12'ye Edebiyat yazmaz", () => {
    const r = plan([{ id: "b12", name: "12-A Fen", grade: 12, track: null }]);
    expect(r.branches[0].track).toBe("sayisal");
    expect(new Set(r.assignments.map((a) => a.subject)).has("Edebiyat")).toBe(false);
  });

  it("eşit ağırlık 12: Edebiyat AYT ağırlığında, Biyoloji sadece TYT payında", () => {
    // ⚠️ İNCE AYRIM (Mert: "TYT hepsinde ortak ama AYT konularında bir
    // sayısalcıyı edebiyattan değerlendiremeyiz"): EA öğrencisi TYT
    // Biyoloji'den SORUMLUDUR, o yüzden programda BULUNUR — ama AYT'sinde
    // olmadığı için sayısal sınıftan BELİRGİN ŞEKİLDE AZ saat alır.
    const ea = plan([{ id: "b12b", name: "12-B Eşit Ağırlık", grade: 12, track: null }]);
    const mf = plan([{ id: "b12a", name: "12-A Fen", grade: 12, track: null }]);
    expect(ea.branches[0].track).toBe("esit_agirlik");
    expect(ea.branches[0].assigned["Edebiyat"] ?? 0).toBeGreaterThan(0);
    const eaBio = ea.branches[0].assigned["Biyoloji"] ?? 0;
    const mfBio = mf.branches[0].assigned["Biyoloji"] ?? 0;
    expect(mfBio).toBeGreaterThan(eaBio);
    // Sayısal sınıfta Edebiyat HİÇ olmamalı — o AYT dersi onun değil.
    expect(mf.branches[0].assigned["Edebiyat"] ?? 0).toBe(0);
  });

  it("aynı öğretmeni aynı gün+saatte iki şubeye koymaz", () => {
    const r = plan([
      { id: "b1", name: "11-A Fen", grade: 11, track: null },
      { id: "b2", name: "12-A Fen", grade: 12, track: null },
      { id: "b3", name: "10-A", grade: 10, track: null },
    ]);
    const seen = new Set<string>();
    for (const a of r.assignments) {
      const k = `${a.teacherId}|${a.day}|${a.slot}`;
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
  });

  it("öğretmenin müsait olmadığı saate ders koymaz", () => {
    const blocked = DAYS.flatMap((day) => SLOTS.map((slot) => ({ teacherId: "t-mat", day, slot })));
    const r = plan([{ id: "b", name: "12-A Fen", grade: 12, track: null }], { blocked });
    expect(r.assignments.some((a) => a.teacherId === "t-mat")).toBe(false);
  });

  it("var olan programın üzerine YAZMAZ", () => {
    const existing = [{ branchId: "b", day: "Pazartesi", slot: "16:00-17:00", teacherId: "t-tur", subject: "Türkçe" }];
    const r = plan([{ id: "b", name: "12-A Fen", grade: 12, track: null }], { existing });
    expect(r.assignments.some((a) => a.day === "Pazartesi" && a.slot === "16:00-17:00")).toBe(false);
  });

  it("branşı olmayan dersi BOŞ bırakır, yanlış öğretmenle doldurmaz", () => {
    const r = buildAutoPlan({
      branches: [{ id: "b", name: "12-C Sözel", grade: 12, track: null }],
      teachers: [{ id: "t-mat", name: "Mat", subject: "Matematik" }],
      days: DAYS,
      slots: SLOTS,
      blocked: [],
    });
    // Sözel'in AYT dersleri (Edebiyat, Tarih...) için öğretmen yok.
    expect(r.branches[0].missingTeacher).toContain("Edebiyat");
    expect(r.assignments.every((a) => a.teacherId === "t-mat")).toBe(true);
    expect(r.unstaffedSubjects).toContain("Edebiyat");
  });

  it("alanı belirsiz 12. sınıfı işaretler ve SADECE TYT verir", () => {
    const r = plan([{ id: "b", name: "12-A VIP", grade: 12, track: null }]);
    expect(r.branches[0].trackMissing).toBe(true);
    expect(r.branches[0].trackLabel).toBe("ALAN GİRİLMEMİŞ");
    expect(new Set(r.assignments.map((a) => a.subject)).has("Geometri")).toBe(false);
  });

  it("aynı girdi AYNI planı üretir (deterministik)", () => {
    const branches: PlanBranch[] = [
      { id: "b1", name: "11-A Fen", grade: 11, track: null },
      { id: "b2", name: "12-B Eşit Ağırlık", grade: 12, track: null },
    ];
    expect(JSON.stringify(plan(branches).assignments)).toBe(JSON.stringify(plan(branches).assignments));
  });

  it("aynı dersi aynı güne yığmamaya çalışır", () => {
    const r = plan([{ id: "b", name: "7-A", grade: 7, track: null }]);
    const perDay = new Map<string, string[]>();
    for (const a of r.assignments) perDay.set(a.day, [...(perDay.get(a.day) ?? []), a.subject]);
    // Hiçbir günde aynı ders 2'den fazla olmasın.
    for (const list of perDay.values()) {
      const counts = new Map<string, number>();
      for (const s of list) counts.set(s, (counts.get(s) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    }
  });
});

describe("kıt öğretmen adaletle dağıtılır", () => {
  it("tek LGS öğretmeni varsa alt sınıflar BOŞ kalmaz", () => {
    // ⚠️ GERÇEK HATA (Arslan verisiyle bulundu): şubeler tek tek
    // doldurulduğunda tek LGS öğretmeni 8. sınıfa gidiyor ve 5/6/7.
    // sınıfların ÜÇÜ DE 0 ders alıyordu.
    const r = buildAutoPlan({
      branches: [
        { id: "b5", name: "5. Sınıf", grade: 5, track: null },
        { id: "b6", name: "6. Sınıf", grade: 6, track: null },
        { id: "b7", name: "7. Sınıf", grade: 7, track: null },
        { id: "b8", name: "8. Sınıf", grade: 8, track: null },
      ],
      teachers: [{ id: "t-lgs", name: "LGS Hoca", subject: "LGS Branş" }],
      days: DAYS,
      slots: SLOTS,
      blocked: [],
    });
    for (const b of r.branches) {
      const total = Object.values(b.assigned).reduce((a, c) => a + c, 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it("öğretmeni olmayan ders ile öğretmeni dolu olan dersi AYIRIR", () => {
    const r = buildAutoPlan({
      branches: [
        { id: "b1", name: "12-A Fen", grade: 12, track: null },
        { id: "b2", name: "11-A Fen", grade: 11, track: null },
      ],
      // Tek matematik öğretmeni: yetmeyecek ama VAR. Felsefe öğretmeni YOK.
      teachers: [{ id: "t-mat", name: "Mat", subject: "Matematik" }],
      days: DAYS,
      slots: SLOTS,
      blocked: [],
    });
    const b = r.branches[0];
    expect(b.missingTeacher).toContain("Felsefe");
    expect(b.missingTeacher).not.toContain("Matematik");
    // Matematik hedefin altında kaldıysa kıtlık listesinde olmalı.
    expect(b.scarceSubjects.length).toBeGreaterThan(0);
  });
});

describe("kural motoru", () => {
  const twoBranches: PlanBranch[] = [
    { id: "b1", name: "12-A Fen", grade: 12, track: null },
    { id: "b2", name: "11-A Fen", grade: 11, track: null },
  ];

  it("öğretmenin izinli günü SERT kuraldır", () => {
    const r = buildAutoPlan({
      branches: twoBranches,
      teachers,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { teacherDaysOff: [{ teacherId: "t-mat", days: ["Pazartesi", "Salı"] }] },
    });
    const violations = r.assignments.filter(
      (a) => a.teacherId === "t-mat" && (a.day === "Pazartesi" || a.day === "Salı")
    );
    expect(violations).toHaveLength(0);
    // Diğer günlerde çalışmaya devam etmeli — kural onu tamamen dışlamamalı.
    expect(r.assignments.some((a) => a.teacherId === "t-mat")).toBe(true);
  });

  it("şubeye özel ders ağırlığı saati artırır", () => {
    const base = buildAutoPlan({ branches: [twoBranches[0]], teachers, days: DAYS, slots: SLOTS, blocked: [] });
    const boosted = buildAutoPlan({
      branches: [twoBranches[0]],
      teachers,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { subjectEmphasis: [{ branchId: "b1", subject: "Fizik", factor: 3 }] },
    });
    expect(boosted.branches[0].assigned["Fizik"] ?? 0).toBeGreaterThan(base.branches[0].assigned["Fizik"] ?? 0);
  });

  it("günde aynı dersten en fazla N kuralına uyar", () => {
    const r = buildAutoPlan({
      branches: [twoBranches[0]],
      teachers,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { maxSameSubjectPerDay: 1 },
    });
    const perDay = new Map<string, Map<string, number>>();
    for (const a of r.assignments) {
      const m = perDay.get(a.day) ?? new Map<string, number>();
      m.set(a.subject, (m.get(a.subject) ?? 0) + 1);
      perDay.set(a.day, m);
    }
    for (const m of perDay.values()) expect(Math.max(...m.values())).toBeLessThanOrEqual(1);
  });

  it("öğretmen günlük azami ders kuralına uyar", () => {
    const r = buildAutoPlan({
      branches: [
        { id: "b1", name: "12-A Fen", grade: 12, track: null },
        { id: "b2", name: "11-A Fen", grade: 11, track: null },
        { id: "b3", name: "10-A", grade: 10, track: null },
      ],
      teachers,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { maxDailyLoadPerTeacher: 2 },
    });
    const load = new Map<string, number>();
    for (const a of r.assignments) {
      const k = `${a.teacherId}|${a.day}`;
      load.set(k, (load.get(k) ?? 0) + 1);
    }
    expect(Math.max(...load.values())).toBeLessThanOrEqual(2);
  });

  it("öğretmen–şube yasağı SERT kuraldır", () => {
    const r = buildAutoPlan({
      branches: twoBranches,
      teachers,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { banTeacherFromBranch: [{ teacherId: "t-fiz", branchId: "b1" }] },
    });
    expect(r.assignments.filter((a) => a.teacherId === "t-fiz" && a.branchId === "b1")).toHaveLength(0);
  });

  it("devamsız sınıfa disiplinli öğretmeni yönlendirir", () => {
    // ⚠️ MERT'İN ÖRNEĞİ: "en çok devamsızlık olan sınıfa devam oranı en
    // yüksek hoca". İki matematik öğretmeni var; biri disiplinli.
    const twoMath = [
      { id: "t-a", name: "A Hoca", subject: "Matematik" },
      { id: "t-b", name: "B Hoca", subject: "Matematik" },
    ];
    const r = buildAutoPlan({
      branches: [
        { id: "bad", name: "12-A Fen", grade: 12, track: null },
        { id: "good", name: "12-B Fen", grade: 12, track: null },
      ],
      teachers: twoMath,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { disciplinedTeacherToAbsentBranch: true },
      signals: {
        branchAbsenceSeverity: { bad: 1, good: 0 },
        branchAcademicWeakness: {},
        teacherAttendanceDiscipline: { "t-a": 1, "t-b": 0 },
        teacherAcademicStrength: {},
      },
    });
    const badBranchTeachers = r.assignments.filter((a) => a.branchId === "bad").map((a) => a.teacherId);
    const aShare = badBranchTeachers.filter((t) => t === "t-a").length / Math.max(1, badBranchTeachers.length);
    expect(aShare).toBeGreaterThan(0.5);
  });

  it("kural uyum raporu üretir", () => {
    const r = buildAutoPlan({
      branches: [twoBranches[0]],
      teachers,
      days: DAYS,
      slots: SLOTS,
      blocked: [],
      rules: { preferDoubleBlocks: true, heavySubjectsEarly: true },
    });
    const ids = r.compliance.map((c) => c.ruleId);
    expect(ids).toContain("preferDoubleBlocks");
    expect(ids).toContain("heavySubjectsEarly");
    for (const c of r.compliance) expect(c.total).toBeGreaterThan(0);
  });

  it("kural yokken davranış DEĞİŞMEZ (geriye dönük uyum)", () => {
    const withoutRules = buildAutoPlan({ branches: twoBranches, teachers, days: DAYS, slots: SLOTS, blocked: [] });
    const withEmptyRules = buildAutoPlan({ branches: twoBranches, teachers, days: DAYS, slots: SLOTS, blocked: [], rules: {} });
    expect(JSON.stringify(withoutRules.assignments)).toBe(JSON.stringify(withEmptyRules.assignments));
  });
});
