import { prisma } from "@/lib/server/prisma";

export const SCHEDULE_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export type ScheduleDay = (typeof SCHEDULE_DAYS)[number];

export type RawScheduleRow = Record<string, unknown>;

export type ScheduleRowResult = {
  rowIndex: number;
  branchName: string;
  teacherName: string;
  day: string;
  slot: string;
  subject: string;
  status: "ok" | "failed";
  error?: string;
  /** Bu satır mevcut bir dersin ÜZERİNE yazacak mı? */
  overwrites?: string;
};

export type ScheduleImportOutcome = {
  results: ScheduleRowResult[];
  okCount: number;
  failedCount: number;
  overwriteCount: number;
};

function cell(row: RawScheduleRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

// Ders programı toplu içe aktarımı — İKİ AŞAMALI.
//
// dryRun=true: hiçbir şey yazılmaz, her satır tek tek doğrulanır ve
// sonuç döner. Müdür 120 satırlık bir dosyayı körlemesine uygulamak
// zorunda kalmasın: önce "hangi satır neden geçmiyor, hangisi mevcut
// dersin üzerine yazacak" görsün.
//
// ⚠️ Çakışma kontrolü DOSYA İÇİNDE de yapılır: aynı öğretmeni aynı
// gün+saatte iki farklı şubeye yazan bir dosya, satırlar tek tek
// bakıldığında geçerli görünür ama uygulandığında ikincisi birinciyi
// bozar. Veritabanındaki mevcut derslerle çakışma ayrıca kontrol edilir.
export async function runScheduleImport(
  rows: RawScheduleRow[],
  institutionId: string,
  options: { dryRun: boolean }
): Promise<ScheduleImportOutcome> {
  const [branches, teachers, slotLabels, existing, unavailable] = await Promise.all([
    prisma.branch.findMany({ where: { institutionId }, select: { id: true, name: true } }),
    prisma.teacher.findMany({ where: { institutionId }, select: { id: true, firstName: true, lastName: true, subject: true } }),
    prisma.scheduleSlotDefinition.findMany({ where: { institutionId }, select: { label: true } }),
    prisma.lessonSlot.findMany({
      where: { branch: { institutionId } },
      select: { branchId: true, teacherId: true, day: true, slot: true, branch: { select: { name: true } } },
    }),
    prisma.teacherUnavailability.findMany({
      where: { teacher: { institutionId } },
      select: { teacherId: true, day: true, slot: true },
    }),
  ]);

  const branchByName = new Map(branches.map((b) => [b.name.trim().toLocaleLowerCase("tr"), b]));
  const teacherByName = new Map(
    teachers.map((t) => [`${t.firstName} ${t.lastName}`.trim().toLocaleLowerCase("tr"), t])
  );
  const validSlots = new Set(slotLabels.map((s) => s.label));
  const unavailableKey = new Set(unavailable.map((u) => `${u.teacherId}|${u.day}|${u.slot}`));

  // Mevcut program: hücre (şube+gün+saat) → ders, ve öğretmen meşguliyeti
  const cellOwner = new Map(existing.map((e) => [`${e.branchId}|${e.day}|${e.slot}`, e]));
  const teacherBusy = new Map(existing.map((e) => [`${e.teacherId}|${e.day}|${e.slot}`, e.branch.name]));

  // Dosya içi çakışma takibi
  const fileCells = new Set<string>();
  const fileTeacherBusy = new Map<string, string>();

  const results: ScheduleRowResult[] = [];
  const writes: { branchId: string; teacherId: string; subject: string; day: string; slot: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const branchName = cell(row, "branchName", "Şube");
    const teacherName = cell(row, "teacherName", "Öğretmen");
    const day = cell(row, "day", "Gün");
    const slot = cell(row, "slot", "Saat");
    const subjectRaw = cell(row, "subject", "Ders");

    const base = { rowIndex: i, branchName, teacherName, day, slot, subject: subjectRaw };
    const fail = (error: string) => results.push({ ...base, status: "failed" as const, error });

    const branch = branchByName.get(branchName.toLocaleLowerCase("tr"));
    if (!branchName) { fail("Şube zorunludur."); continue; }
    if (!branch) { fail(`Şube bulunamadı: "${branchName}".`); continue; }

    const teacher = teacherByName.get(teacherName.toLocaleLowerCase("tr"));
    if (!teacherName) { fail("Öğretmen zorunludur."); continue; }
    if (!teacher) { fail(`Öğretmen bulunamadı: "${teacherName}".`); continue; }

    if (!SCHEDULE_DAYS.includes(day as ScheduleDay)) {
      fail(`Gün geçersiz: "${day}". Geçerli: ${SCHEDULE_DAYS.join(", ")}.`);
      continue;
    }
    if (!validSlots.has(slot)) {
      fail(`Saat kurumda tanımlı değil: "${slot}". Ders Programı > Saat Yönetimi'nden ekleyin.`);
      continue;
    }

    // Ders adı boşsa öğretmenin branşı kullanılır — en sık durum bu,
    // müdürü aynı bilgiyi iki kez yazmaya zorlamanın anlamı yok.
    const subject = subjectRaw || teacher.subject;

    const cellKey = `${branch.id}|${day}|${slot}`;
    const teacherKey = `${teacher.id}|${day}|${slot}`;

    if (fileCells.has(cellKey)) { fail("Bu dosyada aynı şube+gün+saat iki kez var."); continue; }
    const fileClash = fileTeacherBusy.get(teacherKey);
    if (fileClash && fileClash !== branch.name) {
      fail(`Bu dosyada aynı öğretmen aynı saatte "${fileClash}" şubesine de yazılmış.`);
      continue;
    }
    if (unavailableKey.has(teacherKey)) { fail("Öğretmen bu saatte müsait değil olarak işaretli."); continue; }

    const busyBranch = teacherBusy.get(teacherKey);
    if (busyBranch && busyBranch !== branch.name) {
      fail(`Öğretmen bu saatte "${busyBranch}" şubesinde ders veriyor.`);
      continue;
    }

    const occupied = cellOwner.get(cellKey);
    const overwrites =
      occupied && occupied.teacherId !== teacher.id
        ? teachers.find((t) => t.id === occupied.teacherId)
          ? `${teachers.find((t) => t.id === occupied.teacherId)!.firstName} ${teachers.find((t) => t.id === occupied.teacherId)!.lastName}`
          : "mevcut ders"
        : undefined;

    fileCells.add(cellKey);
    fileTeacherBusy.set(teacherKey, branch.name);
    results.push({ ...base, subject, status: "ok", overwrites });
    writes.push({ branchId: branch.id, teacherId: teacher.id, subject, day, slot });
  }

  if (!options.dryRun && writes.length > 0) {
    // Satır satır upsert — tek transaction'a sığdırmak 120+ satırda
    // zaman aşımına takılır (aynı hata deneme netlerinde yaşandı).
    for (const w of writes) {
      await prisma.lessonSlot.upsert({
        where: { branchId_day_slot: { branchId: w.branchId, day: w.day, slot: w.slot } },
        update: { teacherId: w.teacherId, subject: w.subject },
        create: w,
      });
    }
  }

  const okCount = results.filter((r) => r.status === "ok").length;
  return {
    results,
    okCount,
    failedCount: results.length - okCount,
    overwriteCount: results.filter((r) => r.overwrites).length,
  };
}
