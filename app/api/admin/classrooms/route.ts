import { NextRequest, NextResponse } from "next/server";
import { listClassrooms, createClassroom } from "@/lib/server/admin/classrooms";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: kurumun fiziksel sınıf (kroki) listesi — Şube'den BAĞIMSIZ, bkz.
// lib/seating/types.ts'teki gerekçe. Kroki editörü ve "Yeni Oturma
// Planı" akışının sınıf seçicisi buradan beslenir.
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const classrooms = await listClassrooms(session.institutionId);
    return NextResponse.json({ classrooms });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_classrooms_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as { name?: string };
    const classroom = await createClassroom({ institutionId: session.institutionId, actorId: session.sub, name: body.name ?? "" });
    return NextResponse.json({ classroom }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_classroom_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/classrooms", handleGet);
export const POST = withApiLogging("POST /api/admin/classrooms", handlePost);
