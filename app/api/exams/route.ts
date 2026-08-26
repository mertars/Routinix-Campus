import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    const session = await requireSession();
    const exams = await prisma.exam.findMany({ where: { institutionId: session.institutionId }, orderBy: { examDate: "desc" } });
    return NextResponse.json({ exams });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exams_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { name, examDate } = body as { name?: string; examDate?: string };
    if (!name?.trim()) return NextResponse.json({ error: "name zorunludur." }, { status: 400 });
    const exam = await prisma.exam.create({
      data: { institutionId: session.institutionId, name: name.trim(), examDate: examDate ? new Date(examDate) : new Date() },
    });
    return NextResponse.json({ exam }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams", handleGet);
export const POST = withApiLogging("POST /api/exams", handlePost);
