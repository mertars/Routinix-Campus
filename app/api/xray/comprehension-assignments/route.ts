import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { resolveTargetStudentIds, type AssignmentTarget } from "@/lib/server/xray/assignment-target";
import { requireSession, requireRole, requireInstitution, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/xray/comprehension-assignments?studentId=X — bir öğrencinin tüm
// Test 2 atamaları (geçmiş + bekleyen). Öğrenci SADECE kendi atamalarını
// görebilir (bkz. /student panelindeki "bekleyen testlerin" bildirimi);
// yönetici ise atama geçmişini görüntülemek için kullanır.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else requireRole(session, "principal");

    const assignments = await prisma.xrayComprehensionAssignment.findMany({
      where: { studentId },
      orderBy: { assignedAt: "desc" },
      select: { id: true, subject: true, subtopicId: true, status: true, assignedAt: true, completedAt: true, flagReason: true },
    });

    const withNames = assignments.map((a) => {
      const topics = CURRICULUM_TREE[a.subject] ?? [];
      const name = topics.flatMap((t) => t.subtopics).find((s) => s.id === a.subtopicId)?.name ?? a.subtopicId;
      return { ...a, subtopicName: name };
    });

    return NextResponse.json({ assignments: withNames });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_assignments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/xray/comprehension-assignments — { subject, subtopicId, target } —
// yöneticinin "eksik bulduğu konuyu" atamasi. Faz L: artık TEK öğrenciyle
// sınırlı değil — target {type:"student"|"branch"|"grade"} olabilir, bir
// şubenin/sınıf seviyesinin TAMAMINA tek istekle atanabilir (bkz.
// resolveTargetStudentIds — hedef listesi HER ZAMAN sunucuda yeniden
// doğrulanır). Aynı öğrenci aynı konudan TEKRAR test alabilir (bkz. şema
// yorumu, @@unique yok) — bu yüzden mevcut bir atama kontrolü YAPILMAZ,
// her öğrenci için yeni bir atama oluşturulur.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { subject, subtopicId, target } = body as { subject?: string; subtopicId?: string; target?: AssignmentTarget };
    if (!subject?.trim() || !subtopicId?.trim() || !target) {
      return NextResponse.json({ error: "subject, subtopicId ve target zorunludur." }, { status: 400 });
    }

    const questionCount = await prisma.xrayComprehensionQuestion.count({ where: { subject: subject.trim(), subtopicId: subtopicId.trim() } });
    if (questionCount === 0) return NextResponse.json({ error: "Bu konu için soru havuzunda içerik yok." }, { status: 400 });

    const studentIds = await resolveTargetStudentIds(session.institutionId, target);
    if (studentIds.length === 0) return NextResponse.json({ error: "Hedeflenen kapsamda öğrenci bulunamadı." }, { status: 400 });

    const result = await prisma.xrayComprehensionAssignment.createMany({
      data: studentIds.map((studentId) => ({ studentId, subject: subject.trim(), subtopicId: subtopicId.trim(), assignedById: session.sub })),
    });

    return NextResponse.json({ created: result.count }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_assignment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/xray/comprehension-assignments", handleGet);
export const POST = withApiLogging("POST /api/xray/comprehension-assignments", handlePost);
