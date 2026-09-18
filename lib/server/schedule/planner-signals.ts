import { prisma } from "@/lib/server/prisma";
import { POSITIVE_STATUSES, EXCLUDED_FROM_RATE } from "@/lib/attendance/status";
import { normalize, type PlannerSignals } from "@/lib/server/schedule/planner-rules";

// ----------------------------------------------------------------------------
// PLANLAYICI SİNYALLERİ — "akıllı" kuralların dayandığı GERÇEK veri.
//
// ⚠️ NEDEN AYRI DOSYA (Mert, 2026-09-18): "sadece çakışmasız değil; sınıfın
// ortalamasına göre, devamsızlıklara göre, hocanın performansına göre."
// Planlayıcının kendisi SAF ve test edilebilir kalmalı (bkz. auto-plan.ts),
// bu yüzden veritabanına dokunan kısım burada durur.
//
// ⚠️ HİÇBİR SİNYAL UYDURULMAZ. Veri yoksa o sinyal boş kalır ve ilgili
// kural hiçbir şeyi değiştirmez — "veri yok" ile "kötü" karıştırılmaz.
// ----------------------------------------------------------------------------

export async function computePlannerSignals(institutionId: string): Promise<PlannerSignals> {
  const [attendanceCounts, netRows, submissionCounts, lessonSlots] = await Promise.all([
    // Şube bazlı devam: öğrenci üzerinden şubeye bağlanır.
    prisma.attendanceRecord.groupBy({
      by: ["status"],
      where: { student: { institutionId } },
      _count: true,
    }),
    prisma.examNetResult.findMany({
      where: { student: { institutionId } },
      select: { net: true, student: { select: { branchId: true } } },
    }),
    // Öğretmenin yoklama DİSİPLİNİ: kaç kez yoklama gönderdiği.
    prisma.attendanceSubmission.groupBy({
      by: ["teacherId"],
      where: { teacher: { institutionId } },
      _count: true,
    }),
    // Öğretmen → hangi şubelere giriyor (akademik güç için).
    prisma.lessonSlot.findMany({
      where: { branch: { institutionId } },
      select: { teacherId: true, branchId: true },
    }),
  ]);
  void attendanceCounts;

  // --- Şube devamsızlık şiddeti ---
  // Tek sorguda şube kırılımı alınamıyor (groupBy ilişki alanına inemiyor),
  // bu yüzden öğrenci→şube eşlemesiyle ikinci bir toplu sorgu.
  const perStudent = await prisma.attendanceRecord.groupBy({
    by: ["studentId", "status"],
    where: { student: { institutionId } },
    _count: true,
  });
  const students = await prisma.student.findMany({
    where: { institutionId },
    select: { id: true, branchId: true },
  });
  const branchOf = new Map(students.map((s) => [s.id, s.branchId]));
  const branchTotals = new Map<string, { positive: number; counted: number }>();
  for (const row of perStudent) {
    const branchId = branchOf.get(row.studentId);
    if (!branchId) continue;
    if (EXCLUDED_FROM_RATE.includes(row.status as never)) continue;
    const entry = branchTotals.get(branchId) ?? { positive: 0, counted: 0 };
    entry.counted += row._count;
    if (POSITIVE_STATUSES.includes(row.status as never)) entry.positive += row._count;
    branchTotals.set(branchId, entry);
  }
  const branchAttendanceRate = new Map<string, number>();
  for (const [branchId, v] of branchTotals) {
    if (v.counted > 0) branchAttendanceRate.set(branchId, v.positive / v.counted);
  }
  // Devam oranı DÜŞÜK olan şube, şiddeti YÜKSEK olsun → invert.
  const branchAbsenceSeverity = normalize(branchAttendanceRate, true);

  // --- Şube akademik zayıflığı (net ortalaması düşük = zayıf) ---
  const netByBranch = new Map<string, { sum: number; count: number }>();
  for (const r of netRows) {
    const entry = netByBranch.get(r.student.branchId) ?? { sum: 0, count: 0 };
    entry.sum += r.net;
    entry.count += 1;
    netByBranch.set(r.student.branchId, entry);
  }
  const branchAvgNet = new Map<string, number>();
  for (const [branchId, v] of netByBranch) if (v.count > 0) branchAvgNet.set(branchId, v.sum / v.count);
  const branchAcademicWeakness = normalize(branchAvgNet, true);

  // --- Öğretmen devam disiplini ---
  const submissionByTeacher = new Map(submissionCounts.map((r) => [r.teacherId, r._count]));
  const teacherAttendanceDiscipline = normalize(submissionByTeacher);

  // --- Öğretmen akademik gücü: girdiği şubelerin net ortalaması ---
  const branchesOfTeacher = new Map<string, Set<string>>();
  for (const ls of lessonSlots) {
    const set = branchesOfTeacher.get(ls.teacherId) ?? new Set<string>();
    set.add(ls.branchId);
    branchesOfTeacher.set(ls.teacherId, set);
  }
  const teacherNet = new Map<string, number>();
  for (const [teacherId, branchIds] of branchesOfTeacher) {
    let sum = 0;
    let count = 0;
    for (const branchId of branchIds) {
      const entry = netByBranch.get(branchId);
      if (entry) {
        sum += entry.sum;
        count += entry.count;
      }
    }
    if (count > 0) teacherNet.set(teacherId, sum / count);
  }
  const teacherAcademicStrength = normalize(teacherNet);

  return {
    branchAbsenceSeverity,
    branchAcademicWeakness,
    teacherAttendanceDiscipline,
    teacherAcademicStrength,
  };
}
