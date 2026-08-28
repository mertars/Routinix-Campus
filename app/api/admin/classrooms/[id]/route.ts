import { NextRequest, NextResponse } from "next/server";
import { getClassroom, updateClassroomLayout, deleteClassroom } from "@/lib/server/admin/classrooms";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: kroki editörünün açılışta yüklediği tek sınıfın tam verisi.
async function handleGet(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const classroom = await getClassroom(params.id, session.institutionId);
    return NextResponse.json({ classroom });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_classroom_fetch_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PATCH: kroki editöründe masalar sürüklenip/eklenip/silindikten sonra
// "Kaydet" ile TÜM layout'u tek seferde yazar (her sürükleme ANINDA değil
// — gereksiz yazma trafiğinden kaçınmak için).
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as { layout?: unknown };
    const classroom = await updateClassroomLayout({ id: params.id, institutionId: session.institutionId, layout: body.layout });
    return NextResponse.json({ classroom });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_classroom_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await deleteClassroom(params.id, session.institutionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_classroom_delete_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/classrooms/[id]", handleGet);
export const PATCH = withApiLogging("PATCH /api/admin/classrooms/[id]", handlePatch);
export const DELETE = withApiLogging("DELETE /api/admin/classrooms/[id]", handleDelete);
