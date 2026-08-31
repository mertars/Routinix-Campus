import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { validateQuestions } from "@/lib/xray-question-import/validate";
import type { RawQuestion } from "@/lib/xray-question-import/types";
import { slugifyTestName } from "@/lib/server/xray/question-pool-upload";
import { requirePlatformSession } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/practice-questions/upload — { subject, subtopicId,
// test_adi, sorular } — Faz X: Akademik Röntgen'in Test 1 soru havuzu
// KURUM BAZLI DEĞİL (bkz. XrayPracticeQuestion şemasında institutionId
// YOK) — TÜM kurumların paylaştığı TEK bir platform geneli havuz. Bu
// yüzden kurum yöneticisi DEĞİL, platform sahibi yükler (bkz.
// requirePlatformSession). "konu" alanı SADECE görüntüleme amaçlı serbest
// metindir — gerçek puanlama eşlemesi seçilen subject+subtopicId'den
// gelir (prisma/seed-xray-practice-test.ts'teki AYNI kasıtlı ayrım).
//
// lib/bulk-import/validate.ts'teki ÖĞRENCİ/ÖĞRETMEN sihirbazıyla AYNI
// desen: istemci SADECE kendi tarafında geçerli bulduğu satırları
// gönderir, ama sunucu YİNE DE her satırı KENDİSİ yeniden doğrular
// (istemciye güvenilmez) ve HER satır için ayrı success/failed sonucu
// döner — "16 başarılı, 2 başarısız" tarzı kısmi başarı, atomik
// hepsi-ya-da-hiçbiri DEĞİL. Aynı test_adi (testId'ye slugify edilir) ile
// tekrar yüklenirse o testin ESKİ soruları silinip YENİDEN yazılır.
async function handlePost(request: NextRequest) {
  try {
    await requirePlatformSession();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });

    const { subject, subtopicId, test_adi, sorular } = body as {
      subject?: string;
      subtopicId?: string;
      test_adi?: string;
      sorular?: RawQuestion[];
    };
    if (!subject?.trim() || !subtopicId?.trim() || !test_adi?.trim()) {
      return NextResponse.json({ error: "subject, subtopicId ve test_adi zorunludur." }, { status: 400 });
    }
    if (!Array.isArray(sorular) || sorular.length === 0) {
      return NextResponse.json({ error: "sorular boş olamaz." }, { status: 400 });
    }
    if (sorular.length > 200) {
      return NextResponse.json({ error: "Tek yüklemede en fazla 200 soru olabilir." }, { status: 400 });
    }

    const testId = slugifyTestName(test_adi);
    if (!testId) return NextResponse.json({ error: "test_adi geçerli bir kimliğe dönüştürülemedi." }, { status: 400 });

    const validated = validateQuestions(sorular);
    const validRows = validated.filter((r) => r.isValid);

    if (validRows.length > 0) {
      await prisma.$transaction([
        prisma.xrayPracticeQuestion.deleteMany({ where: { testId } }),
        prisma.xrayPracticeQuestion.createMany({
          data: validRows.map((r) => ({
            subject: subject.trim(),
            subtopicId: subtopicId.trim(),
            testId,
            testName: test_adi.trim(),
            order: r.raw.soruNo!,
            kazanimId: r.raw.kazanimId!.trim(),
            prompt: r.raw.questionText!.trim(),
            correctAnswer: r.raw.finalAnswer!.trim(),
            solution: r.raw.detailedSolution!.trim(),
            checks: r.raw.diagnosticComment!.trim(),
          })),
        }),
      ]);
    }

    const results = validated.map((r) => ({
      rowIndex: r.rowIndex,
      label: r.label,
      status: r.isValid ? ("success" as const) : ("failed" as const),
      error: r.isValid ? undefined : r.errors.join(" · "),
    }));

    return NextResponse.json({ testId, results }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_practice_question_upload_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/practice-questions/upload", handlePost);
