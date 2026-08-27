import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { listStudentRosterForMatching } from "@/lib/server/admin/exam-net-results";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Deneme sonucu içe aktarma sihirbazının öğrenci eşleştirme (PDF Yükle) ve
// öğrenci-önceden-doldurma (Elle Gir) adımları için — bkz.
// lib/server/admin/exam-net-results.ts > listStudentRosterForMatching
// (T.C. No döndürdüğü için genel roster ucundan BİLEREK ayrı).
async function handleGet(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id } });
    if (!exam || exam.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });
    }

    const students = await listStudentRosterForMatching(session.institutionId);
    return NextResponse.json({ students });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_roster_fetch_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/roster", handleGet);
