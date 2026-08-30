import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/results/[studentId]?subject=Matematik — bir öğrencinin
// konu bazlı röntgen sonucu (bkz. TopicMasteryAssessment). Sahiplik kuralı
// GET /api/report-cards/[studentId] ile BİREBİR aynı (öğrencinin kendisi/
// danışman-branş öğretmeni/velisi/yönetici).
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

    const assessments = await prisma.topicMasteryAssessment.findMany({
      where: { studentId: params.studentId, subject },
      select: { subtopicId: true, masteryScore: true, source: true, assessedAt: true },
    });
    const scoreBySubtopic = new Map(assessments.map((a) => [a.subtopicId, a]));

    const subtopicNameById = new Map<string, string>();
    for (const topic of CURRICULUM_TREE[subject] ?? []) {
      for (const sub of topic.subtopics) subtopicNameById.set(sub.id, sub.name);
    }

    const topics = (CURRICULUM_TREE[subject] ?? []).map((topic) => ({
      topicName: topic.name,
      grade: topic.grade,
      subtopics: topic.subtopics.map((sub) => {
        const assessment = scoreBySubtopic.get(sub.id);
        return {
          subtopicId: sub.id,
          name: subtopicNameById.get(sub.id) ?? sub.name,
          masteryScore: assessment?.masteryScore ?? null,
          source: assessment?.source ?? null,
          assessedAt: assessment?.assessedAt?.toISOString() ?? null,
        };
      }),
    }));

    return NextResponse.json({ subject, topics });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_results_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/results/[studentId]", handleGet);
