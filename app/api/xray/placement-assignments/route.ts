import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { resolvePlacementScope, buildPlacementQuestionSet } from "@/lib/server/xray/placement-pool";
import { resolveUnitSubtopicIds } from "@/lib/server/xray/unit-label";
import { resolveTargetStudentIds, type AssignmentTarget } from "@/lib/server/xray/assignment-target";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/placement-assignments — { target, subject? } — yöneticinin
// "Seviye Belirleme Sınavı" ataması. practice-assignments'tan (TEK tema)
// farkı: her hedef öğrencinin KENDİ sınıf seviyesine göre (9/10/11 → sadece
// o sınıf, 12/mezun → 9-12'nin TAMAMI) BİRDEN FAZLA temayı TEK bir
// XrayPracticeAttempt'ta birleştirir (bkz. lib/server/xray/placement-pool.ts).
// variant="yerlestirme" — tamamlanma akışı practice-attempt/[id]/complete
// route'unda DEĞİŞİKLİK GEREKTİRMİYOR (zaten variant'tan bağımsız, alt-konu
// bazlı mastery hesaplıyor).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => ({}));
    const { target, subject } = body as { target?: AssignmentTarget; subject?: string };
    if (!target) return NextResponse.json({ error: "target zorunludur." }, { status: 400 });
    const resolvedSubject = subject?.trim() || "Matematik";

    const studentIds = await resolveTargetStudentIds(session.institutionId, target);
    if (studentIds.length === 0) return NextResponse.json({ error: "Hedeflenen kapsamda öğrenci bulunamadı." }, { status: 400 });

    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, branch: { select: { grade: true, segment: true } } },
    });

    let created = 0;
    let skipped = 0;
    for (const student of students) {
      const scope = resolvePlacementScope(resolvedSubject, student.branch.grade, student.branch.segment);
      if (scope.topicIds.length === 0) {
        skipped++;
        continue;
      }

      const selection = await buildPlacementQuestionSet(async (topicId) => {
        const scopeSubtopicIds = resolveUnitSubtopicIds(resolvedSubject, topicId, "genel");
        return prisma.xrayPracticeQuestion.findMany({
          where: { subject: resolvedSubject, subtopicId: { in: scopeSubtopicIds }, variant: "genel" },
          select: { id: true, kazanimId: true, order: true, testId: true },
        });
      }, scope.topicIds);

      if (selection.length === 0) {
        skipped++;
        continue;
      }

      await prisma.xrayPracticeAttempt.create({
        data: {
          studentId: student.id,
          subject: resolvedSubject,
          subtopicId: scope.label,
          variant: "yerlestirme",
          assignedById: session.sub,
          questions: { create: selection.map((s) => ({ questionId: s.id, order: s.order })) },
        },
      });
      created++;
    }

    return NextResponse.json({ created, skipped }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_placement_assignment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/placement-assignments", handlePost);
