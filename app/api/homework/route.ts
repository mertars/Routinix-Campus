import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/homework — öğretmen bir veya birden fazla şubeye ödev atar.
async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, branchIds, title, description, linkUrl, fileNames, checklist, targetQuestionCount, dueAt } = body as {
      teacherId?: string;
      branchIds?: string[];
      title?: string;
      description?: string;
      linkUrl?: string;
      fileNames?: string[];
      checklist?: string[];
      targetQuestionCount?: number;
      dueAt?: string;
    };

    if (!teacherId || !Array.isArray(branchIds) || branchIds.length === 0 || !title?.trim()) {
      return NextResponse.json({ error: "teacherId, branchIds ve title zorunludur." }, { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { id: true } });
    if (!teacher) return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });

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
    logger.error("homework_create_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/homework?teacherId=X | ?branchId=X | ?late=true&limit=N
// teacherId/branchId: homework + o ödevin tüm öğrenci teslim durumları döner
// — matris/liste görünümleri istemci tarafında filtreler (LiveSync'teki
// önceki davranışla aynı). late=true: yönetici canlı akışı için TÜM
// şubelerdeki en son "geç teslim" işaretlemelerini döner.
async function handleGet(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const branchId = request.nextUrl.searchParams.get("branchId");
    const late = request.nextUrl.searchParams.get("late") === "true";

    if (late) {
      const limit = Math.min(20, Number(request.nextUrl.searchParams.get("limit") ?? "4") || 4);
      const submissions = await prisma.homeworkSubmission.findMany({
        where: { status: "LATE" },
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

    const homeworks = await prisma.homework.findMany({
      where: teacherId ? { teacherId } : { branchIds: { has: branchId! } },
      include: { submissions: true, teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ homeworks });
  } catch (error) {
    logger.error("homework_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/homework", handlePost);
export const GET = withApiLogging("GET /api/homework", handleGet);
