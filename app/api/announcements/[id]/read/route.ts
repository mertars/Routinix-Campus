import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/announcements/:id/read — öğrenci duyuruyu görüntülediğinde
// KENDİSİ için okundu olarak işaretler. studentId artık body'den değil
// oturumdan alınır (bir öğrenci başkası adına "okundu" yazamaz).
async function handlePost(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const announcement = await prisma.announcement.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!announcement || announcement.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Duyuru bulunamadı." }, { status: 404 });
    }

    await prisma.announcementRead.upsert({
      where: { announcementId_studentId: { announcementId: params.id, studentId: session.sub } },
      update: {},
      create: { announcementId: params.id, studentId: session.sub },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("announcement_read_failed", { announcementId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/announcements/[id]/read", handlePost);
