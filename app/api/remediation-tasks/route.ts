import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });
    const tasks = await prisma.remediationTask.findMany({ where: { studentId }, orderBy: { assignedAt: "desc" } });
    return NextResponse.json({ tasks });
  } catch (error) {
    logger.error("remediation_tasks_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, topic, taskDescription } = body as { studentId?: string; topic?: string; taskDescription?: string };
    if (!studentId || !topic?.trim() || !taskDescription?.trim()) {
      return NextResponse.json({ error: "studentId, topic ve taskDescription zorunludur." }, { status: 400 });
    }
    const task = await prisma.remediationTask.create({ data: { studentId, topic: topic.trim(), taskDescription: taskDescription.trim() } });
    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    logger.error("remediation_task_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/remediation-tasks", handleGet);
export const POST = withApiLogging("POST /api/remediation-tasks", handlePost);
