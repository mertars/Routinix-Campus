import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { computeActivityScore } from "@/lib/server/teacher-activity";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/teachers-performance — Yönetici panelindeki "Öğretmen
// Performans & Aktivite Matrisi"nin gerçek veri kaynağı. Tekil Performans
// Röntgeni'yle (app/api/admin/users/[id]/analytics) AYNI formülü (Aktiflik
// Skoru) kullanır — iki ekran arasında çelişkili sayı gösterme riski yok.
async function handleGet() {
  try {
    const teachers = await prisma.teacher.findMany({
      include: { teachingBranches: { select: { id: true } } },
      orderBy: [{ subject: "asc" }, { firstName: "asc" }],
    });

    const rows = await Promise.all(
      teachers.map(async (teacher) => {
        const branchIds = teacher.teachingBranches.map((b) => b.id);
        const [classNetResults, attendanceSubmissionCount, homeworkCount, quizCount] = await Promise.all([
          branchIds.length > 0
            ? prisma.examNetResult.findMany({ where: { student: { branchId: { in: branchIds } } }, select: { net: true } })
            : Promise.resolve([]),
          prisma.attendanceSubmission.count({ where: { teacherId: teacher.id } }),
          prisma.homework.count({ where: { teacherId: teacher.id } }),
          prisma.quiz.count({ where: { teacherId: teacher.id } }),
        ]);
        const classAverageNet =
          classNetResults.length === 0 ? null : Math.round((classNetResults.reduce((sum, r) => sum + r.net, 0) / classNetResults.length) * 100) / 100;

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
      })
    );

    return NextResponse.json({ teachers: rows });
  } catch (error) {
    logger.error("teachers_performance_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/teachers-performance", handleGet);
