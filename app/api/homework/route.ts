import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/homework — öğretmen KENDİ adına bir veya birden fazla şubeye
// ödev atar. teacherId body'den değil oturumdan alınır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const body = await request.json();
    const { branchIds, title, description, linkUrl, fileNames, checklist, targetQuestionCount, dueAt } = body as {
      branchIds?: string[];
      title?: string;
      description?: string;
      linkUrl?: string;
      fileNames?: string[];
      checklist?: string[];
      targetQuestionCount?: number;
      dueAt?: string;
    };

    if (!Array.isArray(branchIds) || branchIds.length === 0 || !title?.trim()) {
      return NextResponse.json({ error: "branchIds ve title zorunludur." }, { status: 400 });
    }

    const branchCount = await prisma.branch.count({ where: { id: { in: branchIds }, institutionId: session.institutionId } });
    if (branchCount !== branchIds.length) {
      return NextResponse.json({ error: "Bir veya daha fazla şube bulunamadı." }, { status: 404 });
    }

    const homework = await prisma.homework.create({
      data: {
        teacherId,
        branchIds,
        title: title.trim(),
        description: description?.trim() || null,
        linkUrl: linkUrl?.trim() || null,
        fileNames: fileNames ?? [],
        checklist: checklist ?? [],
        targetQuestionCount: targetQuestionCount ?? null,
        dueAt: dueAt ? new Date(dueAt) : null,
      },
    });

    return NextResponse.json({ homework }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("homework_create_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/homework?teacherId=X | ?branchId=X | ?late=true&limit=N
// teacherId: sadece o öğretmenin KENDİSİ ya da yönetici. branchId: aynı
// kurumdaki herhangi bir oturum (öğrenci kendi şubesini okur). late=true:
// yönetici canlı akışı.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const branchId = request.nextUrl.searchParams.get("branchId");
    const late = request.nextUrl.searchParams.get("late") === "true";

    if (late) {
      requireRole(session, "principal");
      const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? "4") || 4);
      const submissions = await prisma.homeworkSubmission.findMany({
        where: { status: "LATE", student: { institutionId: session.institutionId } },
        orderBy: { updatedAt: "desc" },
        take: limit,
        include: { student: { select: { firstName: true, lastName: true } } },
      });
      return NextResponse.json({
        submissions: submissions.map((s) => ({ studentName: `${s.student.firstName} ${s.student.lastName}`, updatedAt: s.updatedAt.toISOString() })),
      });
    }

    if (!teacherId && !branchId) {
      return NextResponse.json({ error: "teacherId veya branchId parametrelerinden biri zorunludur." }, { status: 400 });
    }

    if (teacherId) {
      if (session.role === "TEACHER") {
        if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
      } else {
        requireRole(session, "principal");
      }
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
      if (!teacher || teacher.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
      }
    } else {
      const branch = await prisma.branch.findUnique({ where: { id: branchId! }, select: { institutionId: true } });
      if (!branch || branch.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
      }
    }

    const homeworks = await prisma.homework.findMany({
      where: teacherId ? { teacherId } : { branchIds: { has: branchId! } },
      include: { submissions: true, teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ homeworks });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("homework_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/homework", handlePost);
export const GET = withApiLogging("GET /api/homework", handleGet);
