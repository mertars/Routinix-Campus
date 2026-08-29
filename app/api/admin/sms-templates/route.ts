import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/admin/sms-templates — Toplu SMS ekranındaki "Mesaj Şablonları"
// panelini besler. Kurumun kendi serbest metin şablonları (InstitutionSmsTemplate)
// — SmsTemplate (key bazlı, tüm kurumlar arası paylaşılan sistem şablonları,
// bkz. prisma/schema.prisma'daki İSİMLENDİRME NOTU) ile KARIŞTIRILMAMALI.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const templates = await prisma.institutionSmsTemplate.findMany({
      where: { institutionId: session.institutionId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("sms_templates_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/admin/sms-templates — { title, content }
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { title, content } = body as { title?: string; content?: string };
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "title ve content zorunludur." }, { status: 400 });
    }

    const template = await prisma.institutionSmsTemplate.create({
      data: { institutionId: session.institutionId, title: title.trim(), content: content.trim() },
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("sms_template_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/sms-templates", handleGet);
export const POST = withApiLogging("POST /api/admin/sms-templates", handlePost);
