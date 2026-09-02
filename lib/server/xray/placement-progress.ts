import { prisma } from "@/lib/server/prisma";

// Faz Q — app/api/xray/placement-progress/[studentId]/route.ts'teki
// hesaplama, custom-report/route.ts'in "Çift Pozlama" bloğuyla PAYLAŞILSIN
// diye buraya taşındı (bkz. lib/server/xray/roadmap.ts'teki AYNI
// "route'lar arası paylaşılan hesaplama" deseni).
const COMPLETION_WINDOW_MS = 10_000;

export type PlacementProgress = { hasPlacement: false } | { hasPlacement: true; before: { avg: number; assessedAt: Date }; after: { avg: number; assessedAt: Date } };

export async function computePlacementProgress(studentId: string, subject: string): Promise<PlacementProgress> {
  const placementAttempt = await prisma.xrayPracticeAttempt.findFirst({
    where: { studentId, subject, variant: "yerlestirme", status: "COMPLETED" },
    orderBy: { assignedAt: "asc" },
    select: { completedAt: true },
  });
  if (!placementAttempt?.completedAt) return { hasPlacement: false };

  const windowEnd = new Date(placementAttempt.completedAt.getTime() + COMPLETION_WINDOW_MS);
  const [beforeRows, afterRows] = await Promise.all([
    prisma.topicMasteryHistory.findMany({
      where: { studentId, subject, assessedAt: { gte: placementAttempt.completedAt, lte: windowEnd } },
      select: { masteryScore: true },
    }),
    prisma.topicMasteryAssessment.findMany({
      where: { studentId, subject },
      select: { masteryScore: true, assessedAt: true },
    }),
  ]);

  if (beforeRows.length === 0 || afterRows.length === 0) return { hasPlacement: false };

  const avg = (rows: { masteryScore: number }[]) => Math.round(rows.reduce((sum, r) => sum + r.masteryScore, 0) / rows.length);
  const lastAssessedAt = afterRows.reduce((latest, r) => (r.assessedAt > latest ? r.assessedAt : latest), afterRows[0].assessedAt);

  return {
    hasPlacement: true,
    before: { avg: avg(beforeRows), assessedAt: placementAttempt.completedAt },
    after: { avg: avg(afterRows), assessedAt: lastAssessedAt },
  };
}
