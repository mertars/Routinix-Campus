import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PUT /api/exams/[id]/answer-key/from-text — { subject, text }. Kullanıcı
// talebi: "cevap anahtarını text olarak girecek alan olsun" — optik
// tarayıcının ürettiği ham cevap harfleri dizisiyle (bkz.
// lib/server/exams/optical-import.ts) AYNI formatta bir metin ("ABCDE…")
// yapıştırılır, her karakter sırayla o soru numarasının doğru cevabı
// olur (metin uzunluğu = soru sayısı, otomatik). Önceden per-soru
// kazanım atanmışsa (subtopicId/subtopicLabel) DOKUNULMAZ — sadece
// correctAnswer güncellenir/eklenir; kazanım ataması ayrı, opsiyonel bir
// adımdır (bkz. answer-key route > PUT).
async function handlePut(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const rawText = typeof body?.text === "string" ? body.text.trim() : "";
    if (!subject || !rawText) return NextResponse.json({ error: "subject ve text zorunludur." }, { status: 400 });

    const upper = rawText.toUpperCase().replace(/\s+/g, "");
    const invalidPositions: number[] = [];
    for (let i = 0; i < upper.length; i++) {
      if (!/[A-E]/.test(upper[i])) invalidPositions.push(i + 1);
    }
    if (invalidPositions.length > 0) {
      const shown = invalidPositions.slice(0, 8).join(", ");
      return NextResponse.json(
        { error: `Geçersiz karakter — soru ${shown}${invalidPositions.length > 8 ? " ..." : ""} (sadece A-E kabul edilir).` },
        { status: 400 }
      );
    }
    if (upper.length > 200) return NextResponse.json({ error: "Cevap anahtarı çok uzun (en fazla 200 soru)." }, { status: 400 });

    const existing = await prisma.examQuestion.findMany({
      where: { examId: params.id, subject },
      select: { questionNumber: true, subtopicId: true, subtopicLabel: true },
    });
    const byNumber = new Map(existing.map((q) => [q.questionNumber, q]));

    const data = Array.from({ length: upper.length }, (_, i) => {
      const questionNumber = i + 1;
      const prev = byNumber.get(questionNumber);
      return {
        examId: params.id,
        subject,
        questionNumber,
        correctAnswer: upper[i],
        subtopicId: prev?.subtopicId ?? null,
        subtopicLabel: prev?.subtopicLabel ?? "Kazanım atanmadı",
      };
    });

    await prisma.$transaction([
      prisma.examQuestion.deleteMany({ where: { examId: params.id, subject, questionNumber: { gt: upper.length } } }),
      ...data.map((d) =>
        prisma.examQuestion.upsert({
          where: { examId_subject_questionNumber: { examId: d.examId, subject: d.subject, questionNumber: d.questionNumber } },
          update: { correctAnswer: d.correctAnswer },
          create: d,
        })
      ),
    ]);

    return NextResponse.json({ questionCount: upper.length, preview: upper });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_answer_key_from_text_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PUT = withApiLogging("PUT /api/exams/[id]/answer-key/from-text", handlePut);
