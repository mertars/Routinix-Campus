import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { DEFAULT_CONTRACT_TEMPLATE } from "@/lib/server/contracts/contract-service";

export const dynamic = "force-dynamic";

// GET — kurumun sözleşme şablonları. Hiç şablonu yoksa varsayılan kayıt
// sözleşmesi iskeleti tohumlanır (bkz. expense-categories'teki aynı desen).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    let templates = await prisma.contractTemplate.findMany({
      where: { institutionId: session.institutionId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (templates.length === 0) {
      await prisma.contractTemplate.create({
        data: { institutionId: session.institutionId, title: DEFAULT_CONTRACT_TEMPLATE.title, content: DEFAULT_CONTRACT_TEMPLATE.content },
      });
      templates = await prisma.contractTemplate.findMany({
        where: { institutionId: session.institutionId, isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }

    return NextResponse.json({ templates: templates.map((t) => ({ id: t.id, title: t.title, content: t.content })) });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("contract_templates_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — yeni şablon ya da mevcut şablonu güncelle ({ id? , title, content }).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const id = body?.id as string | undefined;
    const title = (body?.title as string | undefined)?.trim();
    const content = (body?.content as string | undefined)?.trim();
    if (!title || !content) return NextResponse.json({ error: "title ve content zorunludur." }, { status: 400 });

    if (id) {
      const existing = await prisma.contractTemplate.findUnique({ where: { id }, select: { institutionId: true } });
      if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Şablon bulunamadı." }, { status: 404 });
      const updated = await prisma.contractTemplate.update({ where: { id }, data: { title, content } });
      return NextResponse.json({ template: { id: updated.id, title: updated.title, content: updated.content } });
    }

    const created = await prisma.contractTemplate.create({ data: { institutionId: session.institutionId, title, content } });
    return NextResponse.json({ template: { id: created.id, title: created.title, content: created.content } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("contract_template_save_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/contract-templates", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/contract-templates", handlePost);
