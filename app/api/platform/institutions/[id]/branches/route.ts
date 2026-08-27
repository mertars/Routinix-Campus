import { NextRequest, NextResponse } from "next/server";
import type { BranchSegment } from "@prisma/client";
import { createBranch, listBranches } from "@/lib/server/admin/branches";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Platform sahibinin, seçtiği bir kurum için şube oluşturması/listelemesi —
// app/api/admin/branches/route.ts'in kurum-yöneticisi eşdeğeri, AYNI
// lib/server/admin/branches.ts fonksiyonlarını çağırır.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requirePlatformSession();
    await requirePlatformInstitution(params.id);
    const branches = await listBranches(params.id);
    return NextResponse.json({ branches });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("platform_branches_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

type CreateBody = { name?: string; grade?: number; segment?: BranchSegment; track?: string };

async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformSession();
    await requirePlatformInstitution(params.id);

    const body = (await request.json()) as CreateBody;
    const branch = await createBranch({
      institutionId: params.id,
      actorId: session.sub,
      name: body.name ?? "",
      grade: Number(body.grade),
      segment: body.segment ?? "YKS",
      track: body.track,
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error("platform_branch_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/platform/institutions/[id]/branches", handleGet);
export const POST = withApiLogging("POST /api/platform/institutions/[id]/branches", handlePost);
