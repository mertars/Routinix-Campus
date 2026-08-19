import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

// POST /api/announcements/:id/read — öğrenci duyuruyu görüntülediğinde
// okundu olarak işaretler. Body: { studentId }
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const studentId = (body as { studentId?: string }).studentId;
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });

    await prisma.announcementRead.upsert({
      where: { announcementId_studentId: { announcementId: params.id, studentId } },
      update: {},
      create: { announcementId: params.id, studentId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("announcement_read_failed", { announcementId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/announcements/[id]/read", handlePost);
