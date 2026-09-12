import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// DELETE /api/quizzes/bank/[id] — kullanıcı talebi: soru bankasından bir
// soru "tamamen silinebilsin". Sadece sorunun sahibi öğretmen silebilir.
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const question = await prisma.quizBankQuestion.findUnique({ where: { id: params.id } });
    if (!question || question.teacherId !== session.sub) {
      return NextResponse.json({ error: "Soru bulunamadı." }, { status: 404 });
    }

    await prisma.quizBankQuestion.delete({ where: { id: params.id } });

    if (question.imageUrl?.startsWith("/uploads/")) {
      await unlink(path.join(process.cwd(), "public", question.imageUrl)).catch((error) =>
        logger.error("quiz_bank_image_delete_failed", { questionId: params.id, error: error instanceof Error ? error.message : String(error) })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("quiz_bank_delete_failed", error);
  }
}

export const DELETE = withApiLogging("DELETE /api/quizzes/bank/[id]", handleDelete);
