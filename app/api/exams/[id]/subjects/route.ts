import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { CURRICULUM_TREE } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

// GET /api/exams/[id]/subjects — bu sınavda AÇIKÇA tanımlı ders listesi
// (bkz. ExamSubject, 2026-09-05 sadeleştirmesi — önceden bu liste SADECE
// net/cevap-anahtarı verisi varsa dolu görünüyordu, sıfırdan bir sınavda
// "ders yok" çıkmazına yol açıyordu). Bu migration'dan ÖNCE net/cevap
// anahtarı girilmiş eski sınavlar için ExamSubject satırı hiç yoktur —
// burada KENDİLİĞİNDEN (self-healing) geriye dönük dolduruluyor, ekstra
// bir taşıma script'i gerekmesin diye.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const [existing, netSubjects, answerKeySubjects] = await Promise.all([
      prisma.examSubject.findMany({ where: { examId: params.id }, select: { subject: true } }),
      prisma.examNetResult.findMany({ where: { examId: params.id }, select: { subject: true }, distinct: ["subject"] }),
      prisma.examQuestion.findMany({ where: { examId: params.id }, select: { subject: true }, distinct: ["subject"] }),
    ]);
    const existingNames = new Set(existing.map((r) => r.subject));
    const legacyNames = new Set([...netSubjects.map((r) => r.subject), ...answerKeySubjects.map((r) => r.subject)]);
    const missing = [...legacyNames].filter((s) => !existingNames.has(s));
    if (missing.length > 0) {
      await prisma.examSubject.createMany({ data: missing.map((subject) => ({ examId: params.id, subject })), skipDuplicates: true });
    }

    const answerKeyNames = new Set(answerKeySubjects.map((r) => r.subject));
    const netNames = new Set(netSubjects.map((r) => r.subject));
    const allNames = [...new Set([...existingNames, ...missing])];

    const subjects = allNames.map((subject) => ({
      subject,
      supportsRoentgenBridge: subject in CURRICULUM_TREE,
      hasAnswerKey: answerKeyNames.has(subject),
      hasResults: netNames.has(subject),
    }));

    return NextResponse.json({ subjects });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_subjects_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/exams/[id]/subjects — { subjects: string[] }. Bir ya da birden
// çok dersi tek seferde ekler (hazır paket butonları — örn. "TYT Paketi"
// 4 dersi birden ekler — VE tekil "+ Ekle" AYNI uçtan geçer).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const body = await request.json().catch(() => null);
    const rawSubjects: unknown[] = Array.isArray(body?.subjects) ? body.subjects : [];
    const names = [...new Set(rawSubjects.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => s.length > 0))];
    if (names.length === 0) return NextResponse.json({ error: "En az bir ders adı zorunludur." }, { status: 400 });

    await prisma.examSubject.createMany({ data: names.map((subject) => ({ examId: params.id, subject })), skipDuplicates: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_subjects_create_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// DELETE /api/exams/[id]/subjects?subject=Matematik — bu dersi sınavdan
// kaldırır. Zaten cevap anahtarı/sonuç verisi olan bir dersin YANLIŞLIKLA
// silinip o verinin erişilemez hale gelmesini önlemek için, veri varsa
// REDDEDİLİR (ExamQuestion/ExamNetResult ayrıca silinmeden ExamSubject
// tek başına silinemez).
async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const exam = await prisma.exam.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!exam || exam.institutionId !== session.institutionId) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const subject = request.nextUrl.searchParams.get("subject")?.trim();
    if (!subject) return NextResponse.json({ error: "subject zorunludur." }, { status: 400 });

    const [hasQuestions, hasResults] = await Promise.all([
      prisma.examQuestion.findFirst({ where: { examId: params.id, subject }, select: { id: true } }),
      prisma.examNetResult.findFirst({ where: { examId: params.id, subject }, select: { id: true } }),
    ]);
    if (hasQuestions || hasResults) {
      return NextResponse.json({ error: "Bu derste zaten cevap anahtarı veya sonuç verisi var — önce onları temizlemelisin." }, { status: 409 });
    }

    await prisma.examSubject.deleteMany({ where: { examId: params.id, subject } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_subjects_delete_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams/[id]/subjects", handleGet);
export const POST = withApiLogging("POST /api/exams/[id]/subjects", handlePost);
export const DELETE = withApiLogging("DELETE /api/exams/[id]/subjects", handleDelete);
