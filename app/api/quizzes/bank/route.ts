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

export const GET = withApiLogging("GET /api/quizzes/bank", handleGet);
