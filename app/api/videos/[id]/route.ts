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

// PATCH /api/videos/[id] — { title?, description?, grade?, subject?, topic? }.
// Yükleme sonrası düzenleme — eskiden sadece silip yeniden yüklemek
// mümkündü (video dosyasının/YouTube kaydının kendisine DOKUNMADAN sadece
// metadata düzeltmek için gereksiz bir tekrar-yükleme + kota israfıydı).
// youtubeId'ye ya da status'e KASITLI olarak dokunulmuyor — bu alanlar
// sadece yükleme/işleme akışının kendi iç mantığınca değişir.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const video = await prisma.video.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!video) return NextResponse.json({ error: "Video bulunamadı." }, { status: 404 });
    requireInstitution(session, video.institutionId);

    const body = await request.json().catch(() => null);
    const data: { title?: string; description?: string | null; grade?: number; subject?: string; topic?: string } = {};

    if (body?.title !== undefined) {
      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return NextResponse.json({ error: "title boş olamaz." }, { status: 400 });
      data.title = title;
    }
    if (body?.description !== undefined) {
      data.description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
    }
    if (body?.grade !== undefined) {
      const grade = Number(body.grade);
      if (!Number.isInteger(grade) || grade < 1 || grade > 12) return NextResponse.json({ error: "grade 1-12 arasında olmalı." }, { status: 400 });
      data.grade = grade;
    }
    if (body?.subject !== undefined) {
      const subject = typeof body.subject === "string" ? body.subject.trim() : "";
      if (!subject) return NextResponse.json({ error: "subject boş olamaz." }, { status: 400 });
      data.subject = subject;
    }
    if (body?.topic !== undefined) {
      const topic = typeof body.topic === "string" ? body.topic.trim() : "";
      if (!topic) return NextResponse.json({ error: "topic boş olamaz." }, { status: 400 });
      data.topic = topic;
    }

    const updated = await prisma.video.update({ where: { id: params.id }, data });
    return NextResponse.json({ video: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Video güncellenemedi." }, { status: 500 });
  }
}

export const DELETE = withApiLogging("DELETE /api/videos/[id]", handleDelete);
export const PATCH = withApiLogging("PATCH /api/videos/[id]", handlePatch);
