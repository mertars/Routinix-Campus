import { NextRequest, NextResponse } from "next/server";
import { resolveMentorRequest } from "@/lib/server/admin/alumni";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// PATCH: yönetici, mezunla OKUL DIŞI bir kanaldan (telefon, WhatsApp)
// iletişime geçip talebi onayladıktan/reddettikten SONRA burayı günceller
// — onaylanınca AlumniProfile.contactPhone talep eden öğrenciye açılır.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const body = (await request.json()) as { status?: string };
    if (body.status !== "APPROVED" && body.status !== "REJECTED") {
      return NextResponse.json({ error: "status 'APPROVED' veya 'REJECTED' olmalı." }, { status: 400 });
    }
    const updated = await resolveMentorRequest({ id: params.id, institutionId: session.institutionId, status: body.status });
    return NextResponse.json({ request: updated });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("admin_mentor_request_resolve_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/admin/mentor-requests/[id]", handlePatch);
