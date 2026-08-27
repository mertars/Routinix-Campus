import { NextRequest, NextResponse } from "next/server";
import { resetUserPassword } from "@/lib/server/admin/update-user";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// app/api/admin/users/[id]/reset-password/route.ts'in platform-sahibi
// eşdeğeri — bkz. o dosyadaki not.
async function handlePost(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const session = await requirePlatformSession();
    await requirePlatformInstitution(params.id);

    const body = (await request.json()) as { role?: "STUDENT" | "TEACHER" };
    if (body.role !== "STUDENT" && body.role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const credentials = await resetUserPassword({
      id: params.userId,
      role: body.role,
      institutionId: params.id,
      actorId: session.sub,
    });
    return NextResponse.json({ credentials });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("platform_user_password_reset_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/platform/institutions/[id]/users/[userId]/reset-password", handlePost);
