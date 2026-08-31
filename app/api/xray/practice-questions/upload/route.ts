import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { incomingTestSchema, slugifyTestName } from "@/lib/server/xray/question-pool-upload";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-questions/upload — { subject, subtopicId, test }
// — yöneticinin Test 1 (Konu Bilgisi) soru havuzuna kendi hazırladığı JSON'u
// yüklemesi (bkz. prisma/seed-xray-practice-test.ts'teki AYNI format/
// mantık — bu panel o tek-seferlik script'in yerini alıyor). "konu" alanı
// SADECE görüntüleme amaçlı serbest metindir, GERÇEK ders/konu eşlemesi
// (puanlama/TopicMasteryAssessment için) subject+subtopicId'den gelir —
// ikisi çakışabilir (örn. kullanıcının "9. Sınıf" dediği bir konu gerçek
// müfredatta 12. sınıfa denk gelebilir), bu KASITLI ve BEKLENEN bir ayrım.
// Aynı test_adi (testId'ye slugify edilir) ile TEKRAR yüklenirse o
// testin ESKİ soruları silinip YENİDEN yazılır — idempotent güncelleme.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });

    const { subject, subtopicId, test } = body as { subject?: string; subtopicId?: string; test?: unknown };
    if (!subject?.trim() || !subtopicId?.trim()) {
      return NextResponse.json({ error: "subject ve subtopicId zorunludur." }, { status: 400 });
    }

    const parsed = incomingTestSchema.safeParse(test);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const path = firstIssue.path.join(".");
      return NextResponse.json({ error: `JSON formatı geçersiz${path ? ` (${path})` : ""}: ${firstIssue.message}` }, { status: 400 });
    }
    const incoming = parsed.data;

    const soruNoValues = incoming.sorular.map((q) => q.soruNo);
    if (new Set(soruNoValues).size !== soruNoValues.length) {
      return NextResponse.json({ error: "Aynı soruNo birden fazla kez kullanılmış — her soru benzersiz bir numaraya sahip olmalı." }, { status: 400 });
    }

    const testId = slugifyTestName(incoming.test_adi);
    if (!testId) return NextResponse.json({ error: "test_adi geçerli bir kimliğe dönüştürülemedi." }, { status: 400 });

    await prisma.$transaction([
      prisma.xrayPracticeQuestion.deleteMany({ where: { testId } }),
      prisma.xrayPracticeQuestion.createMany({
        data: incoming.sorular.map((q) => ({
          subject: subject.trim(),
          subtopicId: subtopicId.trim(),
          testId,
          testName: incoming.test_adi,
          order: q.soruNo,
          kazanimId: q.kazanimId,
          prompt: q.questionText,
          correctAnswer: q.finalAnswer,
          solution: q.detailedSolution,
          checks: q.diagnosticComment,
        })),
      }),
    ]);

    return NextResponse.json({ testId, count: incoming.sorular.length }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_question_upload_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-questions/upload", handlePost);
