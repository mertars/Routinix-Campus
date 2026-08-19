import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/exams/[id]/net-results — Mobil Optik Okuyucu'nun taradığı bir
// cevap kağıdının sonucunu GERÇEK ExamNetResult'a yazar (aynı tablo, karne
// PDF'i ve Net Takipçisi'ni de besler — ayrı bir "tarama kaydı" tutulmaz).
// Türkiye YKS/LGS net hesaplama kuralı: net = doğru - yanlış / 4.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { studentId, subject, correct, wrong } = body as { studentId?: string; subject?: string; correct?: number; wrong?: number };
    if (!studentId || !subject?.trim() || typeof correct !== "number" || typeof wrong !== "number") {
      return NextResponse.json({ error: "studentId, subject, correct ve wrong zorunludur." }, { status: 400 });
    }

    const exam = await prisma.exam.findUnique({ where: { id: params.id } });
    if (!exam) return NextResponse.json({ error: "Sınav bulunamadı." }, { status: 404 });

    const net = Math.round((correct - wrong / 4) * 100) / 100;
    const result = await prisma.examNetResult.upsert({
      where: { examId_studentId_subject: { examId: params.id, studentId, subject: subject.trim() } },
      update: { net },
      create: { examId: params.id, studentId, subject: subject.trim(), net },
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    logger.error("exam_net_result_failed", { examId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/exams/[id]/net-results", handlePost);
