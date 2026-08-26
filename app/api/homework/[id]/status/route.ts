import { NextRequest, NextResponse } from "next/server";
import type { HomeworkStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

const VALID_STATUSES = new Set<HomeworkStatus>(["NOT_DONE", "HALF", "DONE", "LATE"]);

// PATCH /api/homework/:id/status — tek bir öğrencinin (self-report) veya
// öğretmenin matristen toplu güncellediği birden fazla öğrencinin durumunu
// günceller. Body: { updates: [{ studentId, status }] }
// STUDENT: SADECE kendi id'sini içeren tek bir güncelleme gönderebilir.
// TEACHER: sadece KENDİ ödevi (homework.teacherId) için, dilediği öğrenciler.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();

    const body = await request.json();
    const updates = (body as { updates?: { studentId: string; status: HomeworkStatus }[] }).updates;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "updates dizisi boş olamaz." }, { status: 400 });
    }
    if (updates.some((u) => !u.studentId || !VALID_STATUSES.has(u.status))) {
      return NextResponse.json({ error: "Her güncelleme geçerli bir studentId ve status içermeli." }, { status: 400 });
    }

    const homework = await prisma.homework.findUnique({
      where: { id: params.id },
      select: { id: true, teacherId: true, teacher: { select: { institutionId: true } } },
    });
    if (!homework || homework.teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Ödev bulunamadı." }, { status: 404 });
    }

    if (session.role === "STUDENT") {
      if (updates.length !== 1 || updates[0].studentId !== session.sub) {
        throw new AuthError("Sadece kendi durumunuzu güncelleyebilirsiniz.", "FORBIDDEN", 403);
      }
    } else if (session.role === "TEACHER") {
      if (homework.teacherId !== session.sub) {
        throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
      }
    } else {
      throw new AuthError("Bu işlem için yetkiniz yok.", "FORBIDDEN_ROLE", 403);
    }

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
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("homework_status_update_failed", { homeworkId: params.id, error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/homework/[id]/status", handlePatch);
