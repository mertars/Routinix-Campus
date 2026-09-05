import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/answer-key?subject= — bu sınavın bu dersteki cevap
// anahtarını (soru→kazanım eşlemesi) döner. Tanımlı değilse boş dizi
// (hata değil — kazanım analizi her sınav/ders için ZORUNLU değil).
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    if (!subject) return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });

    const questions = await prisma.examQuestion.findMany({
      where: { examId: params.id, subject },
      select: { questionNumber: true, subtopicId: true, subtopicLabel: true },
      orderBy: { questionNumber: "asc" },
    });

    return NextResponse.json({ questions, supportsRoentgenBridge: subject in CURRICULUM_TREE });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_answer_key_get_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PUT /api/exams/[id]/answer-key — { subject, questions: [{questionNumber,
// subtopicId?, subtopicLabel}] }. O sınav+dersin TÜM cevap anahtarını
// DEĞİŞTİRİR (sil+yeniden oluştur — genelde <100 satır, bu boyutta bir
// upsert/diff mantığından daha basit ve daha az hataya açık). Kullanıcı
// talebi: "hepsi birbirini besleyen modüller zinciri" — bkz.
// lib/server/exams/subtopic-breakdown.ts, bu tablo o köprünün girdisidir.
async function handlePut(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const rawQuestions = Array.isArray(body?.questions) ? body.questions : [];
    if (!subject || rawQuestions.length === 0) {
      return NextResponse.json({ error: "subject ve questions zorunludur." }, { status: 400 });
    }

    const validSubtopicIds = new Set((CURRICULUM_TREE[subject] ?? []).flatMap((topic) => topic.subtopics.map((s) => s.id)));

    const data: { examId: string; subject: string; questionNumber: number; subtopicId: string | null; subtopicLabel: string }[] = [];
    for (const q of rawQuestions) {
      const questionNumber = Number(q?.questionNumber);
      const subtopicLabel = typeof q?.subtopicLabel === "string" ? q.subtopicLabel.trim() : "";
      if (!Number.isInteger(questionNumber) || questionNumber < 1 || !subtopicLabel) continue;
      const subtopicId = typeof q?.subtopicId === "string" && validSubtopicIds.has(q.subtopicId) ? q.subtopicId : null;
      data.push({ examId: params.id, subject, questionNumber, subtopicId, subtopicLabel });
    }
    if (data.length === 0) return NextResponse.json({ error: "Geçerli hiçbir soru satırı yok." }, { status: 400 });

    await prisma.$transaction([
      prisma.examQuestion.deleteMany({ where: { examId: params.id, subject } }),
      prisma.examQuestion.createMany({ data }),
    ]);

    return NextResponse.json({ count: data.length, supportsRoentgenBridge: subject in CURRICULUM_TREE });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_answer_key_put_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/answer-key", handleGet);
export const PUT = withApiLogging("PUT /api/exams/[id]/answer-key", handlePut);
