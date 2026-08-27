import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { bulkUpsertExamNetResults, type NetResultRow } from "@/lib/server/admin/exam-net-results";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Deneme sonucu içe aktarma sihirbazının (PDF ayrıştırma veya elle giriş
// ızgarası) SON adımı — bir sınavın TÜM satırlarını tek istekte, tek
// transaction'da yazar. Tek satırlık düzeltmeler için mevcut
// POST /api/exams/[id]/net-results (bkz. o dosyadaki not) hâlâ geçerli,
// bu ikisi birbirini DEĞİŞTİRMEZ.
type Body = { rows?: NetResultRow[]; source?: "pdf-import" | "manual-grid" };

async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id } });
    if (!exam || exam.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });
    }

    const body = (await request.json()) as Body;
    if (!Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json({ error: "rows zorunludur ve boş olamaz." }, { status: 400 });
    }
    const source = body.source === "manual-grid" ? "manual-grid" : "pdf-import";

    const outcome = await bulkUpsertExamNetResults({
      examId: params.id,
      institutionId: session.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      source,
      rows: body.rows,
    });

    return NextResponse.json(outcome, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_net_results_bulk_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/net-results/bulk", handlePost);
