import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/quizzes/bank — öğretmenin KENDİ tekrar kullanılabilir Pop-Quiz
// soru bankası (bir quiz her bittiğinde buraya otomatik eklenir). teacherId
// artık query'den değil oturumdan alınır (bir öğretmen başkasının bankasını
// göremez).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const questions = await prisma.quizBankQuestion.findMany({
      where: { teacherId: session.sub },
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json({ questions });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_bank_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/quizzes/bank — { questions: [{ imageUrl, imageLabel, answer? }] }.
// Kullanıcı talebi: "soru bankası için soru ekleme kısmı yok... 20 30 40
// soru fotoğrafını seçip yükleyebilsin" — bankaya elle/toplu ekleme akışının
// ilk kez açıldığı uç (öncesinde sadece bir quiz bittiğinde OTOMATİK
// doluyordu). Fotoğraflar önce /api/uploads/question-image ile GERÇEKTEN
// yüklenmiş olmalı (bkz. components/teacher/tabs/material-library.tsx),
// burada sadece o URL'ler DB'ye yazılır — dosya işlemi burada YOK.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json().catch(() => null);
    const questions: unknown[] = Array.isArray(body?.questions) ? body.questions : [];
    const valid = questions.filter(
      (q: unknown): q is { imageUrl: string; imageLabel?: string; answer?: string } =>
        typeof q === "object" && q !== null && typeof (q as { imageUrl?: unknown }).imageUrl === "string" && (q as { imageUrl: string }).imageUrl.trim().length > 0
    );
    if (valid.length === 0) {
      return NextResponse.json({ error: "En az bir geçerli soru (imageUrl) zorunludur." }, { status: 400 });
    }

    const created = await prisma.quizBankQuestion.createMany({
      data: valid.map((q) => ({
        teacherId: session.sub,
        imageUrl: q.imageUrl.trim(),
        imageLabel: q.imageLabel?.trim() || "Soru fotoğrafı",
        answer: q.answer?.trim() || "",
      })),
    });

    return NextResponse.json({ count: created.count }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("quiz_bank_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/quizzes/bank", handleGet);
export const POST = withApiLogging("POST /api/quizzes/bank", handlePost);
