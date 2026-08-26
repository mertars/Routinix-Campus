import { NextRequest, NextResponse } from "next/server";
import type { GuidanceCategory, ConfidentialityLevel } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/guidance-notes — bir öğretmen öğrenciyi rehberliğe sevk eder /
// bir görüşme notu ekler. Sadece öğrenciyle ilişkili (danışman/branş)
// öğretmen ya da yönetici not ekleyebilir.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json();
    const { studentId, authorName, category, confidentialityLevel, note } = body as {
      studentId?: string;
      authorName?: string;
      category?: GuidanceCategory;
      confidentialityLevel?: ConfidentialityLevel;
      note?: string;
    };

    if (!studentId || !authorName?.trim() || !note?.trim()) {
      return NextResponse.json({ error: "studentId, authorName ve note zorunludur." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);

    const guidanceNote = await prisma.guidanceNote.create({
      data: {
        studentId,
        authorName: authorName.trim(),
        category: category ?? "ACADEMIC",
        confidentialityLevel: confidentialityLevel ?? "RESTRICTED",
        note: note.trim(),
      },
    });

    await recordAuditLog({
      institutionId: student.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      action: "GUIDANCE_NOTE_CREATED",
      targetType: "Student",
      targetId: studentId,
      metadata: { category: guidanceNote.category, confidentialityLevel: guidanceNote.confidentialityLevel },
    });

    return NextResponse.json({ guidanceNote }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("guidance_note_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// GET /api/guidance-notes?studentId=X  veya  ?feed=true&limit=N
// feed=true: yönetici canlı akışı — CONFIDENTIAL notlar burada ASLA görünmez.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const studentId = request.nextUrl.searchParams.get("studentId");
    const isFeed = request.nextUrl.searchParams.get("feed") === "true";

    if (isFeed) {
      requireRole(session, "principal");
      const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? "4") || 4);
      const notes = await prisma.guidanceNote.findMany({
        where: { confidentialityLevel: { not: "CONFIDENTIAL" }, student: { institutionId: session.institutionId } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json({
        notes: notes.map((n) => ({
          id: n.id,
          authorName: n.authorName,
          studentName: `${n.student.firstName} ${n.student.lastName}`,
          category: n.category,
          confidentialityLevel: n.confidentialityLevel,
          createdAt: n.createdAt.toISOString(),
        })),
      });
    }

    if (!studentId) {
      return NextResponse.json({ error: "studentId veya feed=true parametrelerinden biri zorunludur." }, { status: 400 });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, studentId);

    const notes = await prisma.guidanceNote.findMany({ where: { studentId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ notes });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("guidance_notes_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/guidance-notes", handlePost);
export const GET = withApiLogging("GET /api/guidance-notes", handleGet);
