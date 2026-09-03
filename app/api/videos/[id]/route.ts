import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// DELETE /api/videos/[id] — sadece kütüphaneden/atamalardan (onDelete:
// Cascade) kaldırır. YouTube'daki videonun kendisine DOKUNMAZ — o video
// ayrı bir kanalda (bizim kontrolümüz dışında bir hesapta olabilir),
// silme kararı burada değil YouTube tarafında verilir.
async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const video = await prisma.video.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!video) return NextResponse.json({ error: "Video bulunamadı." }, { status: 404 });
    requireInstitution(session, video.institutionId);

    await prisma.video.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_delete_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Video silinemedi." }, { status: 500 });
  }
}

export const DELETE = withApiLogging("DELETE /api/videos/[id]", handleDelete);
