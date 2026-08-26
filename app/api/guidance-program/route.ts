import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/guidance-program?studentId=X — rehberlik biriminin öğrenciye
// gönderdiği kişisel çalışma programlarının geçmişi (yönetici paneli).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId parametresi zorunludur." }, { status: 400 });
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const programs = await prisma.guidanceProgram.findMany({
      where: { studentId },
      include: { entries: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ programs });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("guidance_program_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/guidance-program — { studentId, weekLabel, entries: [{day,time,subject,topic,questionTarget}] }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { studentId, weekLabel, entries } = body as {
      studentId?: string;
      weekLabel?: string;
      entries?: { day: string; time: string; subject: string; topic: string; questionTarget: number }[];
    };
    if (!studentId || !weekLabel?.trim() || !Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: "studentId, weekLabel ve en az bir entry zorunludur." }, { status: 400 });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const program = await prisma.guidanceProgram.create({
      data: {
        studentId,
        weekLabel: weekLabel.trim(),
        entries: { create: entries.map((e) => ({ day: e.day, time: e.time, subject: e.subject, topic: e.topic, questionTarget: e.questionTarget })) },
      },
      include: { entries: true },
    });

    return NextResponse.json({ program }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("guidance_program_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/guidance-program", handleGet);
export const POST = withApiLogging("POST /api/guidance-program", handlePost);
