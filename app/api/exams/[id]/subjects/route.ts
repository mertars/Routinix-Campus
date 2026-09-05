import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/subjects — bu sınav için ŞU ANA KADAR net girilmiş
// dersleri döner (kazanım analizi ekranının ders seçicisi buradan besleniyor
// — serbest metin yazdırıp "Matematik" ile "matematik" gibi eşleşmeyen iki
// ayrı ders yaratmayı önlemek için, bkz. exam-kazanim-analysis.tsx).
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const rows = await prisma.examNetResult.findMany({ where: { examId: params.id }, select: { subject: true }, distinct: ["subject"] });
    const subjects = rows.map((r) => ({ subject: r.subject, supportsRoentgenBridge: r.subject in CURRICULUM_TREE }));

    return NextResponse.json({ subjects });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_subjects_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/subjects", handleGet);
