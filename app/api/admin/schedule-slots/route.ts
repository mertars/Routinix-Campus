import { NextRequest, NextResponse } from "next/server";
import { listScheduleSlots, createScheduleSlot } from "@/lib/server/admin/schedule-slots";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET: kurumun ders programı saat dilimi listesi — Ders Programı ekranındaki
// ızgara sütunlarını ve saat yönetimi panelini besler.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const slots = await listScheduleSlots(session.institutionId);
    return NextResponse.json({ slots });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("admin_schedule_slots_list_failed", error);
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const body = (await request.json()) as { label?: string };
    const slot = await createScheduleSlot({ institutionId: session.institutionId, label: body.label ?? "" });
    return NextResponse.json({ slot }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure("admin_schedule_slot_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/admin/schedule-slots", handleGet);
export const POST = withApiLogging("POST /api/admin/schedule-slots", handlePost);
