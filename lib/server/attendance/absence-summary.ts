import { prisma } from "@/lib/server/prisma";

export type AbsenceSummary = { dailyAbsenceCount: number; lessonAbsenceCount: number };

// Yönetici Yoklama Matrisi'nin (salt okunur) "Günlük Devamsızlık" / "Ders
// Devamsızlığı" gösterimini besler. Aynı AttendanceRecord tablosundan İKİ
// FARKLI Prisma aggregation'ı ile hesaplanır — ayrı bir özet tablosu YOK:
//
// - lessonAbsenceCount: kaç ayrı DERS SAATİNDE (satırda) ABSENT işaretlenmiş
//   (bkz. Part 4 örneği: bir günde 3 derse girmese bile bu sayı 3 olur).
// - dailyAbsenceCount: kaç FARKLI GÜNDE en az bir ABSENT var (aynı örnekte
//   bu sayı 1 olur) — groupBy(["studentId","date"]) ile aynı (student,date)
//   çiftini TEK bir gruba indirger, sonra grup sayısı studentId'ye göre
//   sayılır (tek bir groupBy çağrısı, roster boyutundan bağımsız — N+1 yok).
export async function getAbsenceSummaries(studentIds: string[]): Promise<Map<string, AbsenceSummary>> {
  if (studentIds.length === 0) return new Map();

  const [lessonGroups, dayGroups] = await Promise.all([
    prisma.attendanceRecord.groupBy({
      by: ["studentId"],
      where: { studentId: { in: studentIds }, status: "ABSENT" },
      _count: { _all: true },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["studentId", "date"],
      where: { studentId: { in: studentIds }, status: "ABSENT" },
    }),
  ]);

  const summaries = new Map<string, AbsenceSummary>();
  for (const id of studentIds) summaries.set(id, { dailyAbsenceCount: 0, lessonAbsenceCount: 0 });

  for (const group of lessonGroups) {
    const entry = summaries.get(group.studentId);
    if (entry) entry.lessonAbsenceCount = group._count._all;
  }
  for (const group of dayGroups) {
    const entry = summaries.get(group.studentId);
    if (entry) entry.dailyAbsenceCount += 1;
  }

  return summaries;
}

export async function getAbsenceSummary(studentId: string): Promise<AbsenceSummary> {
  const summaries = await getAbsenceSummaries([studentId]);
  return summaries.get(studentId) ?? { dailyAbsenceCount: 0, lessonAbsenceCount: 0 };
}
