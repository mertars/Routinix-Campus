import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    if (session.role === "TEACHER") {
      if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    } else {
      requireRole(session, "principal");
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }
    const rows = await prisma.yearlyPlanRow.findMany({ where: { teacherId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ rows });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("yearly_plan_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { weekLabel, subtopicName, notes } = body as {
      weekLabel?: string;
      subtopicName?: string;
      notes?: string;
    };
    if (!weekLabel?.trim() || !subtopicName?.trim()) {
      return NextResponse.json({ error: "weekLabel ve subtopicName zorunludur." }, { status: 400 });
    }
    const created = await prisma.yearlyPlanRow.create({
      data: { teacherId, weekLabel: weekLabel.trim(), subtopicName: subtopicName.trim(), notes: notes?.trim() || null },
    });
    return NextResponse.json({ row: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("yearly_plan_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/yearly-plan", handleGet);
export const POST = withApiLogging("POST /api/yearly-plan", handlePost);
