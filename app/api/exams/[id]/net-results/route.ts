import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/exams/[id]/net-results — Mobil Optik Okuyucu'nun taradığı bir
// cevap kağıdının sonucunu GERÇEK ExamNetResult'a yazar (aynı tablo, karne
// PDF'i ve Net Takipçisi'ni de besler — ayrı bir "tarama kaydı" tutulmaz).
// Türkiye YKS/LGS net hesaplama kuralı: net = doğru - yanlış / 4.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json();
    const { studentId, subject, correct, wrong } = body as { studentId?: string; subject?: string; correct?: number; wrong?: number };
    if (!studentId || !subject?.trim() || typeof correct !== "number" || typeof wrong !== "number") {
      return NextResponse.json({ error: "studentId, subject, correct ve wrong zorunludur." }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({ where: { id: params.id } });
    if (!exam || exam.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });
    }

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    }

    const net = Math.round((correct - wrong / 4) * 100) / 100;
    const result = await prisma.examNetResult.upsert({
      where: { examId_studentId_subject: { examId: params.id, studentId, subject: subject.trim() } },
      update: { net },
      create: { examId: params.id, studentId, subject: subject.trim(), net },
    });

    await recordAuditLog({
      institutionId: session.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      action: "GRADE_ENTERED",
      targetType: "ExamNetResult",
      targetId: result.id,
      metadata: { examId: params.id, studentId, subject: subject.trim(), net },
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_net_result_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/net-results", handlePost);
