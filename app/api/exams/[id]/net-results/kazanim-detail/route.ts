import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { syncExamResultToRoentgen } from "@/lib/server/exams/subtopic-breakdown";

export const dynamic = "force-dynamic";

type Row = { studentId: string; wrongQuestionNumbers?: number[]; blankQuestionNumbers?: number[] };

// PUT /api/exams/[id]/net-results/kazanim-detail — { subject, rows }.
// Net'i DEĞİL, SADECE bir öğrencinin hangi soruları yanlış/boş bıraktığını
// günceller — net zaten ayrı bir akışta (import sihirbazı ya da elle tek
// satır) girilmiş olmalı; burada satırı bulunamayan öğrenci "net girilmemiş"
// diye atlanır (400 değil, o satır sonucunda "skipped" olarak raporlanır —
// diğer satırların kaydını engellemesin diye). Kazanım Eşleştirme (cevap
// anahtarı, bkz. answer-key/route.ts) BU uçtan ÖNCE tanımlanmış olmalı ki
// syncExamResultToRoentgen'in hesaplayacak bir şeyi olsun.
async function handlePut(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const rows = Array.isArray(body?.rows) ? (body.rows as Row[]) : [];
    if (!subject || rows.length === 0) return NextResponse.json({ error: "subject ve rows zorunludur." }, { status: 400 });

    const validStudents = await prisma.student.findMany({
      where: { id: { in: rows.map((r) => r.studentId) }, institutionId: session.institutionId },
      select: { id: true },
    });
    const validStudentIds = new Set(validStudents.map((s) => s.id));

    let successCount = 0;
    let skippedCount = 0;
    const syncableStudentIds: string[] = [];

    for (const row of rows) {
      if (!validStudentIds.has(row.studentId)) {
        skippedCount++;
        continue;
      }
      const wrongQuestionNumbers = (row.wrongQuestionNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0);
      const blankQuestionNumbers = (row.blankQuestionNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0);
      try {
        await prisma.examNetResult.update({
          where: { examId_studentId_subject: { examId: params.id, studentId: row.studentId, subject } },
          data: { wrongQuestionNumbers, blankQuestionNumbers },
        });
        successCount++;
        syncableStudentIds.push(row.studentId);
      } catch {
        // Bu öğrenci için bu ders/sınavda henüz net girilmemiş — kazanım
        // detayının yazılacağı bir satır yok, atla (hata değil).
        skippedCount++;
      }
    }

    if (subject in CURRICULUM_TREE) {
      for (const studentId of syncableStudentIds) {
        await syncExamResultToRoentgen(params.id, studentId, subject).catch(() => {});
      }
    }

    return NextResponse.json({ successCount, skippedCount, supportsRoentgenBridge: subject in CURRICULUM_TREE });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_kazanim_detail_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PUT = withApiLogging("PUT /api/exams/[id]/net-results/kazanim-detail", handlePut);
