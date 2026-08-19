import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/quizzes/bank?teacherId=X — öğretmenin tekrar kullanılabilir
// Pop-Quiz soru bankası (bir quiz her bittiğinde buraya otomatik eklenir).
async function handleGet(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) {
      return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    }
    const questions = await prisma.quizBankQuestion.findMany({
      where: { teacherId },
      orderBy: { addedAt: "desc" },
    });
    return NextResponse.json({ questions });
  } catch (error) {
    logger.error("quiz_bank_list_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/quizzes/bank", handleGet);
