import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { upsertReportCardTeacherComment, getReportCardTeacherComment } from "@/lib/server/report-card/teacher-comment";
import {
  requireSession,
  requireInstitution,
  assertOwnsSelf,
  assertTeacherOwnsStudent,
  assertParentOwnsStudent,
} from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/report-cards/:studentId/comment?donem=X — karneyi görüntüleme
// yetkisi olan HERKES (GET /api/report-cards/[studentId] ile aynı kural)
// mevcut yorumu önizleyebilir; yazma SADECE öğretmen/yönetici (bkz. PUT).
async function handleGet(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const periodLabel = request.nextUrl.searchParams.get("donem")?.trim() || "Güncel Dönem";
    const comment = await getReportCardTeacherComment(params.studentId, periodLabel);
    return NextResponse.json({ comment: comment?.comment ?? null, updatedAt: comment?.updatedAt ?? null });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("report_card_comment_fetch_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/report-cards/:studentId/comment — { donem, comment } — SADECE
// öğrencinin danışman/branş öğretmeni yazabilir. Yönetici DAHİL edilmedi:
// ReportCardTeacherComment.teacherId gerçek bir Teacher kaydına bağlı,
// yöneticinin "öğretmen kimliği" yok — bu alan bilerek danışman/branş
// öğretmeninin KENDİ gözlemi için (plan: "öğretmen görüşü").
async function handlePut(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();
    if (session.role !== "TEACHER") {
      return NextResponse.json({ error: "Karne yorumu sadece danışman/branş öğretmeni tarafından eklenebilir." }, { status: 403 });
    }

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);
    await assertTeacherOwnsStudent(session.sub, params.studentId);

    const body = (await request.json()) as { donem?: string; comment?: string };
    const periodLabel = body.donem?.trim() || "Güncel Dönem";
    if (!body.comment?.trim()) return NextResponse.json({ error: "Yorum metni boş olamaz." }, { status: 400 });

    const updated = await upsertReportCardTeacherComment({
      studentId: params.studentId,
      periodLabel,
      teacherId: session.sub,
      comment: body.comment,
    });
    return NextResponse.json({ comment: updated.comment, updatedAt: updated.updatedAt });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("report_card_comment_update_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/report-cards/[studentId]/comment", handleGet);
export const PUT = withApiLogging("PUT /api/report-cards/[studentId]/comment", handlePut);
