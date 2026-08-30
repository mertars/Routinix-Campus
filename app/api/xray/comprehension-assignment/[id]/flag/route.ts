import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/xray/comprehension-assignment/[id]/flag — { reason } — kilit
// ihlali (sekme değiştirme, pencere odağı kaybı, tam ekrandan çıkma)
// tespit edildiğinde sınavı SONLANDIRIR. Tarayıcıda gerçek bir OS seviyeli
// engelleme YOK — bu, "gerçekçi maksimum" seviyenin caydırıcı tarafı:
// ihlal algılanır algılanmaz sınav biter, öğrenci geri dönemez.
// İDEMPOTENT — istemci tarafında visibilitychange + blur AYNI anda
// tetiklenebilir, ikinci çağrı hata VERMEZ, sessizce no-op olur.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const assignment = await prisma.xrayComprehensionAssignment.findUnique({ where: { id: params.id } });
    if (!assignment) return NextResponse.json({ error: "Atama bulunamadı." }, { status: 404 });
    assertOwnsSelf(session, assignment.studentId);

    if (assignment.status === "COMPLETED" || assignment.status === "FLAGGED") {
      return NextResponse.json({ ok: true, alreadyEnded: true });
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body as { reason?: string };

    await prisma.xrayComprehensionAssignment.update({
      where: { id: assignment.id },
      data: { status: "FLAGGED", completedAt: new Date(), flagReason: reason?.trim() || "Kilit ihlali tespit edildi." },
    });

    return NextResponse.json({ ok: true, alreadyEnded: false });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("xray_comprehension_flag_failed", { assignmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/xray/comprehension-assignment/[id]/flag", handlePost);
