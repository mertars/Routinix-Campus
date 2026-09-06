import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher", "principal");

    const existing = await prisma.osymReferenceTable.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!existing || existing.institutionId !== session.institutionId) return NextResponse.json({ error: "Tablo bulunamadı." }, { status: 404 });

    await prisma.osymReferenceTable.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("osym_table_delete_failed", { tableId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const DELETE = withApiLogging("DELETE /api/osym-reference-tables/[id]", handleDelete);
