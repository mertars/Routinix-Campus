import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { bulkUpsertExamNetResults, type NetResultRow } from "@/lib/server/admin/exam-net-results";

export const dynamic = "force-dynamic";

// POST /api/exams/[id]/optical-upload/confirm — { subject, rows: [{
// studentId, net, wrongQuestionNumbers, blankQuestionNumbers }] }. Önizleme
// ekranında admin eşleşmeleri gözden geçirip (eşleşmeyen satırları elle
// düzeltip/atlayarak) onayladıktan SONRA çağrılır — bkz. optical-upload/
// route.ts (o uç hiçbir şey kaydetmez, bu uç kaydeder). Kaydetme, PDF
// sihirbazıyla AYNI toplu yazma yolunu (bulkUpsertExamNetResults)
// kullanır — bu da Röntgen köprüsünü otomatik tetikler.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const rawRows = Array.isArray(body?.rows) ? body.rows : [];
    if (!subject || rawRows.length === 0) return NextResponse.json({ error: "subject ve rows zorunludur." }, { status: 400 });

    const rows: NetResultRow[] = [];
    for (const r of rawRows) {
      const studentId = typeof r?.studentId === "string" ? r.studentId : "";
      const net = Number(r?.net);
      if (!studentId || !Number.isFinite(net)) continue;
      const wrongQuestionNumbers = Array.isArray(r?.wrongQuestionNumbers) ? r.wrongQuestionNumbers.filter((n: unknown) => Number.isInteger(n)) : [];
      const blankQuestionNumbers = Array.isArray(r?.blankQuestionNumbers) ? r.blankQuestionNumbers.filter((n: unknown) => Number.isInteger(n)) : [];
      rows.push({ studentId, subject, net, wrongQuestionNumbers, blankQuestionNumbers });
    }
    if (rows.length === 0) return NextResponse.json({ error: "Kaydedilecek eşleşmiş satır yok." }, { status: 400 });

    const result = await bulkUpsertExamNetResults({
      examId: params.id,
      institutionId: session.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      source: "optical-import",
      rows,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("optical_upload_confirm_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/optical-upload/confirm", handlePost);
