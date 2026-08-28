import { NextRequest, NextResponse } from "next/server";
import { renameScheduleSlot, deleteScheduleSlot } from "@/lib/server/admin/schedule-slots";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH: yeniden adlandırır — o etikete sahip TÜM LessonSlot/TeacherDutySlot
// kayıtlarını da (tek transaction'da) günceller, bkz. schedule-slots.ts.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const body = (await request.json()) as { label?: string };
    const slot = await renameScheduleSlot({ id: params.id, institutionId: session.institutionId, label: body.label ?? "" });
    return NextResponse.json({ slot });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_schedule_slot_rename_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await deleteScheduleSlot(params.id, session.institutionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_schedule_slot_delete_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/admin/schedule-slots/[id]", handlePatch);
export const DELETE = withApiLogging("DELETE /api/admin/schedule-slots/[id]", handleDelete);
