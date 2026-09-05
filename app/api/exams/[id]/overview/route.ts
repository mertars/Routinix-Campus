import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/overview — Ölçme Değerlendirme detay ekranının TEK
// veri kaynağı (2026-09-05 yeniden yazımı). Önceden bu ekran 4-5 ayrı uca
// paralel istek atıp durumu kendi birleştiriyordu; bu hem yavaştı hem de
// "hangi adım tamam, hangisi eksik" mantığı istemciye dağılmıştı. Artık
// tek bir çağrı: dersler + her dersin beklenen/girilen soru sayısı +
// sonuç durumu. Adım göstergesi (Cevap Anahtarı → Sonuçlar → Rapor)
// doğrudan bu yanıttan besleniyor.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({
      where: { id: params.id },
      include: { opticalFormat: { include: { subjectBlocks: { orderBy: { order: "asc" } } } } },
    });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Deneme bulunamadı." }, { status: 404 });

    const [examSubjects, questionGroups, answeredGroups, resultGroups, distinctStudents] = await Promise.all([
      prisma.examSubject.findMany({ where: { examId: params.id }, orderBy: { createdAt: "asc" }, select: { subject: true } }),
      prisma.examQuestion.groupBy({ by: ["subject"], where: { examId: params.id }, _count: { _all: true } }),
      prisma.examQuestion.groupBy({ by: ["subject"], where: { examId: params.id, correctAnswer: { not: null } }, _count: { _all: true } }),
      prisma.examNetResult.groupBy({ by: ["subject"], where: { examId: params.id }, _count: { _all: true } }),
      prisma.examNetResult.findMany({ where: { examId: params.id }, select: { studentId: true }, distinct: ["studentId"] }),
    ]);

    const questionCountBySubject = new Map(questionGroups.map((g) => [g.subject, g._count._all]));
    const answeredCountBySubject = new Map(answeredGroups.map((g) => [g.subject, g._count._all]));
    const resultCountBySubject = new Map(resultGroups.map((g) => [g.subject, g._count._all]));
    const blockBySubject = new Map(exam.opticalFormat?.subjectBlocks.map((b) => [b.subject, b]) ?? []);

    // Ders sırası: şablon bloklarının FİZİKSEL sırası önce (optik dosyadaki
    // sırayla aynı olsun), şablonda olmayan ekstra dersler sonra.
    const orderedNames = [
      ...(exam.opticalFormat?.subjectBlocks.map((b) => b.subject) ?? []),
      ...examSubjects.map((s) => s.subject).filter((s) => !blockBySubject.has(s)),
    ];
    const seen = new Set<string>();
    const subjects = orderedNames
      .filter((name) => (seen.has(name) ? false : (seen.add(name), true)))
      .map((subject) => {
        const block = blockBySubject.get(subject);
        return {
          subject,
          // Beklenen soru sayısı = şablondaki sütun uzunluğu (yoksa girilmiş
          // cevap anahtarı uzunluğu; o da yoksa bilinmiyor).
          expectedQuestionCount: block?.length ?? questionCountBySubject.get(subject) ?? null,
          questionCount: questionCountBySubject.get(subject) ?? 0,
          answeredCount: answeredCountBySubject.get(subject) ?? 0,
          resultCount: resultCountBySubject.get(subject) ?? 0,
          supportsRoentgenBridge: subject in CURRICULUM_TREE,
        };
      });

    return NextResponse.json({
      exam: { id: exam.id, name: exam.name, examDate: exam.examDate, opticalFormatId: exam.opticalFormatId },
      format: exam.opticalFormat
        ? { id: exam.opticalFormat.id, name: exam.opticalFormat.name, subjectBlocks: exam.opticalFormat.subjectBlocks.map((b) => ({ subject: b.subject, start: b.start, length: b.length })) }
        : null,
      subjects,
      studentCount: distinctStudents.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_overview_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/overview", handleGet);
