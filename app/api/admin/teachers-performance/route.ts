import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeActivityScore } from "@/lib/server/teacher-activity";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withTtlCache } from "@/lib/server/cache/ttl-cache";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const TEACHERS_PERFORMANCE_CACHE_TTL_MS = 20_000;

// GET /api/admin/teachers-performance — Yönetici panelindeki "Öğretmen
// Performans & Aktivite Matrisi"nin gerçek veri kaynağı. Tekil Performans
// Röntgeni'yle (app/api/admin/users/[id]/analytics) AYNI formülü (Aktiflik
// Skoru) kullanır — iki ekran arasında çelişkili sayı gösterme riski yok.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const rows = await withTtlCache(
      `teachers-performance:${session.institutionId}`,
      TEACHERS_PERFORMANCE_CACHE_TTL_MS,
      () => computeTeachersPerformance(session.institutionId)
    );

    return NextResponse.json({ teachers: rows });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teachers_performance_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// ⚠️ Önceki sürüm HER öğretmen için 4 ayrı sorguyu Promise.all ile "paralel"
// çalıştırıyordu ama bu paralellik ÖĞRETMEN SAYISINA göre çarpanlıydı (N
// öğretmen × 4 sorgu = 4N eşzamanlı istek) — Prisma bağlantı havuzu
// (bkz. lib/server/prisma.ts, max: 10) bu kadar öğretmende sıraya girip
// beklemeye başlıyor, gerçek N+1 gecikmesi buradan geliyordu. Şimdi TÜM
// öğretmenler için sabit sayıda (öğretmen sayısından bağımsız) toplu
// sorgu çalışıyor, sonuçlar JS'te öğretmen bazında gruplanıyor.
async function computeTeachersPerformance(institutionId: string) {
  // ⚠️ attendance/homework/quiz sorguları ÖNCE öğretmenleri çekip id
  // listesine indirgemeyi BEKLEMİYOR — `teacherId: {in: teacherIds}}`
  // yerine `teacher: {institutionId}}` ilişki filtresiyle DOĞRUDAN
  // uygulanıyor, bu yüzden öğretmen sorgusuyla AYNI Promise.all turunda
  // çalışabiliyor (bkz. app/api/admin/dashboard/route.ts'teki AYNI desen).
  const [teachers, branchNetResults, attendanceCounts, homeworkCounts, quizCounts] = await Promise.all([
    prisma.teacher.findMany({
      where: { institutionId },
      include: { teachingBranches: { select: { id: true } } },
      orderBy: [{ subject: "asc" }, { firstName: "asc" }],
    }),
    prisma.examNetResult.findMany({ where: { student: { institutionId } }, select: { net: true, student: { select: { branchId: true } } } }),
    prisma.attendanceSubmission.groupBy({ by: ["teacherId"], where: { teacher: { institutionId } }, _count: true }),
    prisma.homework.groupBy({ by: ["teacherId"], where: { teacher: { institutionId } }, _count: true }),
    prisma.quiz.groupBy({ by: ["teacherId"], where: { teacher: { institutionId } }, _count: true }),
  ]);

  const netByBranch = new Map<string, { sum: number; count: number }>();
  for (const r of branchNetResults) {
    const entry = netByBranch.get(r.student.branchId) ?? { sum: 0, count: 0 };
    entry.sum += r.net;
    entry.count += 1;
    netByBranch.set(r.student.branchId, entry);
  }
  const attendanceByTeacher = new Map(attendanceCounts.map((r) => [r.teacherId, r._count]));
  const homeworkByTeacher = new Map(homeworkCounts.map((r) => [r.teacherId, r._count]));
  const quizByTeacher = new Map(quizCounts.map((r) => [r.teacherId, r._count]));

  return teachers.map((teacher) => {
    // Öğretmenin verdiği TÜM şubelerdeki net sonuçları (şube ortalamalarının
    // ortalaması DEĞİL, şube başına ağırlıklı toplam/sayı) tek havuzda topla.
    let sum = 0;
    let count = 0;
    for (const branch of teacher.teachingBranches) {
      const entry = netByBranch.get(branch.id);
      if (entry) {
        sum += entry.sum;
        count += entry.count;
      }
    }
    const classAverageNet = count === 0 ? null : Math.round((sum / count) * 100) / 100;
    const attendanceSubmissionCount = attendanceByTeacher.get(teacher.id) ?? 0;
    const homeworkCount = homeworkByTeacher.get(teacher.id) ?? 0;
    const quizCount = quizByTeacher.get(teacher.id) ?? 0;

    return {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      subject: teacher.subject,
      classAverageNet,
      attendanceSubmissionCount,
      homeworkCount,
      quizCount,
      activityScore: computeActivityScore({ attendanceSubmissionCount, homeworkCount, quizCount }),
    };
  });
}

export const GET = withApiLogging("GET /api/admin/teachers-performance", handleGet);
