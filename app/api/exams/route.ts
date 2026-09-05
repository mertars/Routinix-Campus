import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet() {
  try {
    const session = await requireSession();
    const exams = await prisma.exam.findMany({ where: { institutionId: session.institutionId }, orderBy: { examDate: "desc" } });
    return NextResponse.json({ exams });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exams_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/exams — { name, examDate, opticalFormatId? }. opticalFormatId
// verilirse (bkz. "Yeni Deneme Oluştur" sihirbazı, components/olcme/
// new-exam-wizard.tsx) sınav o optik ŞABLONA bağlanır VE şablonun ders
// bloklarının TAMAMI otomatik ExamSubject olarak eklenir — yönetici ayrıca
// "hangi dersler var" adımını tekrar yapmak zorunda kalmaz.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const body = await request.json();
    const { name, examDate, opticalFormatId } = body as { name?: string; examDate?: string; opticalFormatId?: string };
    if (!name?.trim()) return NextResponse.json({ error: "name zorunludur." }, { status: 400 });

    let formatSubjects: string[] = [];
    if (opticalFormatId) {
      const format = await prisma.opticalFormat.findUnique({
        where: { id: opticalFormatId },
        select: { institutionId: true, subjectBlocks: { select: { subject: true } } },
      });
      if (!format || format.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Optik şablon bulunamadı." }, { status: 404 });
      }
      formatSubjects = format.subjectBlocks.map((b) => b.subject);
    }

    const exam = await prisma.exam.create({
      data: {
        institutionId: session.institutionId,
        name: name.trim(),
        examDate: examDate ? new Date(examDate) : new Date(),
        opticalFormatId: opticalFormatId ?? null,
      },
    });

    if (formatSubjects.length > 0) {
      await prisma.examSubject.createMany({ data: formatSubjects.map((subject) => ({ examId: exam.id, subject })), skipDuplicates: true });
    }

    return NextResponse.json({ exam }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("exam_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/exams", handleGet);
export const POST = withApiLogging("POST /api/exams", handlePost);
