import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { listTemplates, saveTemplate, deleteTemplate, markTemplateUsed } from "@/lib/server/templates/template-service";
import { TEMPLATE_MODULE_LABEL, type TemplateModule } from "@/lib/templates/catalog";

export const dynamic = "force-dynamic";

const MODULES = Object.keys(TEMPLATE_MODULE_LABEL) as TemplateModule[];

function parseModule(value: string | null): TemplateModule | null {
  return value && (MODULES as string[]).includes(value) ? (value as TemplateModule) : null;
}

// GET ?module=ANNOUNCEMENT — o modülün hazır + kuruma ait şablonları.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "teacher");

    const templateModule = parseModule(request.nextUrl.searchParams.get("module"));
    if (!templateModule) {
      return NextResponse.json({ error: `module geçersiz. Geçerli değerler: ${MODULES.join(", ")}` }, { status: 400 });
    }

    const templates = await listTemplates(session.institutionId, templateModule);
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("templates_list_failed", error);
  }
}

// POST { module, name, description?, payload } — kendi şablonunu kaydet.
// POST ?used=<id> — bir şablonun kullanıldığını işaretle (sayaç).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "teacher");

    const usedId = request.nextUrl.searchParams.get("used");
    if (usedId) {
      await markTemplateUsed(session.institutionId, usedId);
      return NextResponse.json({ ok: true });
    }

    const body = await request.json().catch(() => null);
    const templateModule = parseModule(body?.module ?? null);
    if (!templateModule) {
      return NextResponse.json({ error: `module geçersiz. Geçerli değerler: ${MODULES.join(", ")}` }, { status: 400 });
    }

    const saved = await saveTemplate({
      institutionId: session.institutionId,
      module: templateModule,
      name: String(body?.name ?? ""),
      description: body?.description as string | undefined,
      payload: body?.payload as Record<string, unknown>,
      createdByAdminId: session.sub,
    });

    return NextResponse.json({ id: saved.id, name: saved.name }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure("template_save_failed", error);
  }
}

// DELETE ?id=... — yalnızca kurumun kendi şablonu.
async function handleDelete(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id zorunludur." }, { status: 400 });

    await deleteTemplate(session.institutionId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure("template_delete_failed", error);
  }
}

export const GET = withApiLogging("GET /api/templates", handleGet);
export const POST = withApiLogging("POST /api/templates", handlePost);
export const DELETE = withApiLogging("DELETE /api/templates", handleDelete);
