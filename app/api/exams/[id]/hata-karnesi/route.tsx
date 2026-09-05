import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computeExamSubtopicBreakdown } from "@/lib/server/exams/subtopic-breakdown";
import { PdfPracticeWorksheet, type PdfPracticeWorksheetQuestion } from "@/components/pdf/pdf-practice-worksheet";

export const dynamic = "force-dynamic";

const QUESTIONS_PER_SUBTOPIC = 3;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// GET /api/exams/[id]/hata-karnesi?subject= — "Hata Karnesi" (öğrenci
// kendi, sadece kendi verisi). Edesis'in aynı adlı özelliği yanlış/boş
// yapılan SORULARI aynen tekrar basıyor — biz bunu YAPAMAYIZ (o sorular
// yayınevine ait, elimizde metinleri yok, sadece soru NUMARASI+kazanım
// eşlemesi var, bkz. ExamQuestion). Bunun yerine daha özgün bir yol:
// öğrencinin yanlış/boş yaptığı HER kazanım için Röntgen'in kendi AI soru
// havuzundan (XrayPracticeQuestion — önceden üretilmiş, bkz. o modelin
// üstündeki not) YENİ, denk zorlukta sorular seçip aynı worksheet
// PDF'iyle (bkz. practice-worksheet/route.tsx) kazanım başlıklı bir
// tekrar kitapçığı halinde sunuyoruz — telif riski yok, her seferinde
// biraz farklı (havuzdan rastgele seçim).
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    if (!subject) return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });

    const [exam, netResult] = await Promise.all([
      prisma.exam.findUnique({ where: { id: params.id }, select: { name: true } }),
      prisma.examNetResult.findUnique({ where: { examId_studentId_subject: { examId: params.id, studentId: session.sub, subject } } }),
    ]);
    if (!exam || !netResult) return NextResponse.json({ error: "Sınav sonucu bulunamadı." }, { status: 404 });

    const breakdown = await computeExamSubtopicBreakdown(params.id, session.sub, subject);
    const weakSubtopics = breakdown.filter((row): row is typeof row & { subtopicId: string } => row.subtopicId !== null && (row.wrong > 0 || row.blank > 0));
    if (weakSubtopics.length === 0) {
      return NextResponse.json({ error: "Bu ders için hata karnesi oluşturulacak eksik kazanım bulunamadı." }, { status: 400 });
    }

    const poolBySubtopic = await Promise.all(
      weakSubtopics.map((row) =>
        prisma.xrayPracticeQuestion.findMany({ where: { subject, subtopicId: row.subtopicId }, select: { prompt: true } })
      )
    );

    const questions: PdfPracticeWorksheetQuestion[] = [];
    weakSubtopics.forEach((row, i) => {
      const sampled = shuffle(poolBySubtopic[i]).slice(0, QUESTIONS_PER_SUBTOPIC);
      for (const q of sampled) {
        questions.push({ order: questions.length + 1, prompt: q.prompt, sectionLabel: row.subtopicLabel });
      }
    });
    if (questions.length === 0) {
      return NextResponse.json({ error: "Eksik kazanımlar için henüz hazır soru bulunamadı." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { name: true, logoUrl: true } });

    const pdfBuffer = await renderToBuffer(
      <PdfPracticeWorksheet
        institutionName={institution?.name ?? ""}
        logoUrl={institution?.logoUrl}
        testName={`Hata Karnesi — ${exam.name}`}
        subject={subject}
        questions={questions}
      />
    );

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="hata-karnesi-${params.id}.pdf"` },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_hata_karnesi_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/hata-karnesi", handleGet);
