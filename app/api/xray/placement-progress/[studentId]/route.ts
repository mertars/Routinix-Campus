import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Bir "yerlestirme" (Seviye Belirleme Sınavı) tamamlandığında,
// practice-attempt/[id]/complete route'u alt-konu bazlı TopicMasteryHistory
// satırlarını AYNI istek içinde, art arda yazıyor (bkz. o route'un satır
// 60-72 döngüsü) — bu yüzden birkaç saniyelik bir tolerans penceresi
// yeterli, tam saniye eşleşmesi ARANMAZ.
const COMPLETION_WINDOW_MS = 10_000;

// GET /api/xray/placement-progress/[studentId]?subject= — "Öncesi/Sonrası"
// kartı için veri: öğrencinin İLK tamamladığı yerlestirme sınavı anındaki
// ortalama (önce) ile GÜNCEL ortalamayı (sonra) döner. Sahiplik kuralı
// /api/xray/report/[studentId] ile BİREBİR aynı.
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const subject = request.nextUrl.searchParams.get("subject");
    if (!subject?.trim()) return NextResponse.json({ error: "subject parametresi zorunludur." }, { status: 400 });

    const placementAttempt = await prisma.xrayPracticeAttempt.findFirst({
      where: { studentId: params.studentId, subject, variant: "yerlestirme", status: "COMPLETED" },
      orderBy: { assignedAt: "asc" },
      select: { completedAt: true },
    });
    if (!placementAttempt?.completedAt) return NextResponse.json({ hasPlacement: false });

    const windowEnd = new Date(placementAttempt.completedAt.getTime() + COMPLETION_WINDOW_MS);
    const [beforeRows, afterRows] = await Promise.all([
      prisma.topicMasteryHistory.findMany({
        where: { studentId: params.studentId, subject, assessedAt: { gte: placementAttempt.completedAt, lte: windowEnd } },
        select: { masteryScore: true },
      }),
      prisma.topicMasteryAssessment.findMany({
        where: { studentId: params.studentId, subject },
        select: { masteryScore: true, assessedAt: true },
      }),
    ]);

    if (beforeRows.length === 0 || afterRows.length === 0) return NextResponse.json({ hasPlacement: false });

    const avg = (rows: { masteryScore: number }[]) => Math.round(rows.reduce((sum, r) => sum + r.masteryScore, 0) / rows.length);
    const lastAssessedAt = afterRows.reduce((latest, r) => (r.assessedAt > latest ? r.assessedAt : latest), afterRows[0].assessedAt);

    return NextResponse.json({
      hasPlacement: true,
      before: { avg: avg(beforeRows), assessedAt: placementAttempt.completedAt },
      after: { avg: avg(afterRows), assessedAt: lastAssessedAt },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_placement_progress_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/placement-progress/[studentId]", handleGet);
