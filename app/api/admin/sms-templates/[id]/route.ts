import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH /api/admin/sms-templates/:id — { title?, content? }
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const existing = await prisma.institutionSmsTemplate.findUnique({ where: { id: params.id } });
    if (!existing || existing.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şablon bulunamadı." }, { status: 404 });
    }

    const body = await request.json();
    const { title, content } = body as { title?: string; content?: string };
    if (title !== undefined && !title.trim()) {
      return NextResponse.json({ error: "title boş olamaz." }, { status: 400 });
    }
    if (content !== undefined && !content.trim()) {
      return NextResponse.json({ error: "content boş olamaz." }, { status: 400 });
    }

    const template = await prisma.institutionSmsTemplate.update({
      where: { id: params.id },
      data: { title: title?.trim(), content: content?.trim() },
    });
    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("sms_template_update_failed", { templateId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// DELETE /api/admin/sms-templates/:id
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const existing = await prisma.institutionSmsTemplate.findUnique({ where: { id: params.id } });
    if (!existing || existing.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şablon bulunamadı." }, { status: 404 });
    }

    await prisma.institutionSmsTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("sms_template_delete_failed", { templateId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/admin/sms-templates/[id]", handlePatch);
export const DELETE = withApiLogging("DELETE /api/admin/sms-templates/[id]", handleDelete);
