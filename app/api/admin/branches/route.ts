import { NextRequest, NextResponse } from "next/server";
import type { BranchSegment } from "@prisma/client";
import { createBranch, listBranches } from "@/lib/server/admin/branches";
import { AdminCreateError } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET: kurumun şube listesi — Kullanıcı Ekle/Toplu İçe Aktar modallarındaki
// şube seçicileri buradan beslenir (bkz. add-user-modal.tsx, branch-staff.tsx).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const branches = await listBranches(session.institutionId);
    return NextResponse.json({ branches });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_branches_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

type CreateBody = { name?: string; grade?: number; segment?: BranchSegment; track?: string };

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as CreateBody;
    const branch = await createBranch({
      institutionId: session.institutionId,
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
    logger.error("admin_branch_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/admin/branches", handleGet);
export const POST = withApiLogging("POST /api/admin/branches", handlePost);
