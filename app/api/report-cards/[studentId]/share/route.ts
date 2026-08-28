import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { createReportCardShareLink } from "@/lib/server/report-card/share-link";
import { requireSession, requireInstitution, assertOwnsSelf, assertTeacherOwnsStudent, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/report-cards/:studentId/share — { donem } — karneyi ZATEN
// görüntüleme yetkisi olan biri (öğrenci/danışman-branş öğretmeni/veli/
// yönetici — GET /api/report-cards/[studentId] ile BİREBİR aynı sahiplik
// kuralı) için, oturum açmadan erişilebilen 7 günlük bir paylaşım linki
// üretir.
async function handlePost(request: NextRequest, { params }: { params: { studentId: string } }) {
  try {
    const session = await requireSession();

    const student = await prisma.student.findUnique({ where: { id: params.studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    requireInstitution(session, student.institutionId);
    if (session.role === "STUDENT") assertOwnsSelf(session, params.studentId);
    else if (session.role === "TEACHER") await assertTeacherOwnsStudent(session.sub, params.studentId);
    else if (session.role === "PARENT") await assertParentOwnsStudent(session.sub, params.studentId);

    const body = (await request.json().catch(() => ({}))) as { donem?: string };
    const periodLabel = body.donem?.trim() || "Güncel Dönem";

    const { token, expiresAt } = await createReportCardShareLink({ studentId: params.studentId, periodLabel });
    const shareUrl = `${request.nextUrl.origin}/api/report-cards/shared/${token}`;

    return NextResponse.json({ shareUrl, expiresAt }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("report_card_share_failed", { studentId: params.studentId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/report-cards/[studentId]/share", handlePost);
