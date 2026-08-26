import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, studentId);

    const tasks = await prisma.remediationTask.findMany({ where: { studentId }, orderBy: { assignedAt: "desc" } });
    return NextResponse.json({ tasks });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("remediation_tasks_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json();
    const { studentId, topic, taskDescription } = body as { studentId?: string; topic?: string; taskDescription?: string };
    if (!studentId || !topic?.trim() || !taskDescription?.trim()) {
      return NextResponse.json({ error: "studentId, topic ve taskDescription zorunludur." }, { status: 400 });
    }
    await assertTeacherOwnsStudent(session.sub, studentId);
    const task = await prisma.remediationTask.create({ data: { studentId, topic: topic.trim(), taskDescription: taskDescription.trim() } });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("remediation_task_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/remediation-tasks", handleGet);
export const POST = withApiLogging("POST /api/remediation-tasks", handlePost);
