import { NextRequest, NextResponse } from "next/server";
import type { HomeworkStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

const VALID_STATUSES = new Set<HomeworkStatus>(["NOT_DONE", "HALF", "DONE", "LATE"]);

// PATCH /api/homework/:id/status — tek bir öğrencinin (self-report) veya
// öğretmenin matristen toplu güncellediği birden fazla öğrencinin durumunu
// günceller. Body: { updates: [{ studentId, status }] }
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const updates = (body as { updates?: { studentId: string; status: HomeworkStatus }[] }).updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates dizisi boş olamaz." }, { status: 400 });
    }
    if (updates.some((u) => !u.studentId || !VALID_STATUSES.has(u.status))) {
      return NextResponse.json({ error: "Her güncelleme geçerli bir studentId ve status içermeli." }, { status: 400 });
    }

    const homework = await prisma.homework.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!homework) return NextResponse.json({ error: "Ödev bulunamadı." }, { status: 404 });

    await prisma.$transaction(
      updates.map((update) =>
        prisma.homeworkSubmission.upsert({
          where: { homeworkId_studentId: { homeworkId: params.id, studentId: update.studentId } },
          update: { status: update.status },
          create: { homeworkId: params.id, studentId: update.studentId, status: update.status },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("homework_status_update_failed", { homeworkId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/homework/[id]/status", handlePatch);
