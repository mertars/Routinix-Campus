import { NextRequest, NextResponse } from "next/server";
import { reactivateUserAccount } from "@/lib/server/admin/update-user";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// app/api/admin/users/[id]/reactivate/route.ts'in platform-sahibi eşdeğeri.
async function handlePost(request: NextRequest, { params }: { params: { id: string; userId: string } }) {
  try {
    const session = await requirePlatformSession();
    await requirePlatformInstitution(params.id);

    const body = (await request.json()) as { role?: "STUDENT" | "TEACHER" };
    if (body.role !== "STUDENT" && body.role !== "TEACHER") {
      return NextResponse.json({ error: "role 'STUDENT' veya 'TEACHER' olmalı." }, { status: 400 });
    }

    const result = await reactivateUserAccount({
      id: params.userId,
      role: body.role,
      institutionId: params.id,
      actorId: session.sub,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    return apiFailure("platform_user_reactivate_failed", error);
  }
}

export const POST = withApiLogging("POST /api/platform/institutions/[id]/users/[userId]/reactivate", handlePost);
