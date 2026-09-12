import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertTeacherTeachesBranch } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// DELETE /api/materials/[id] — kullanıcı talebi: "silme hakkı olsun,
// silerse tamamen silinsin" — hem veritabanı kaydı HEM diskteki gerçek
// dosya (bkz. lib/server/uploads/save-teacher-material.ts'in AYNI
// public/uploads/materials yolu) kaldırılır, soft-delete DEĞİL.
async function handleDelete(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const material = await prisma.teacherMaterial.findUnique({ where: { id: params.id } });
    if (!material) return NextResponse.json({ error: "Materyal bulunamadı." }, { status: 404 });
    await assertTeacherTeachesBranch(session.sub, material.branchId);

    await prisma.teacherMaterial.delete({ where: { id: params.id } });

    if (material.fileUrl.startsWith("/uploads/")) {
      await unlink(path.join(process.cwd(), "public", material.fileUrl)).catch((error) =>
        logger.error("material_file_delete_failed", { materialId: params.id, error: error instanceof Error ? error.message : String(error) })
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("material_delete_failed", error);
  }
}

export const DELETE = withApiLogging("DELETE /api/materials/[id]", handleDelete);
