import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { saveTeacherMaterial, MAX_MATERIAL_BYTES } from "@/lib/server/uploads/save-teacher-material";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/materials?branchId=X — Ders Materyali Kütüphanesi (öğretmen +
// öğrenci "Ders Notları" bölümü AYNI tabloyu okur).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const branchId = request.nextUrl.searchParams.get("branchId");
    if (!branchId) return NextResponse.json({ error: "branchId parametresi zorunludur." }, { status: 400 });
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }
    const materials = await prisma.teacherMaterial.findMany({ where: { branchId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ materials });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("materials_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/materials — multipart/form-data: file, branchId, title?
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    const form = await request.formData();
    const file = form.get("file");
    const branchId = form.get("branchId");
    const title = form.get("title");

    if (!(file instanceof File) || typeof branchId !== "string") {
      return NextResponse.json({ error: "file ve branchId zorunludur." }, { status: 400 });
    }
    if (file.size > MAX_MATERIAL_BYTES) {
      return NextResponse.json({ error: "Dosya 20MB sınırını aşıyor." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }

    const { fileUrl, fileType, sizeLabel } = await saveTeacherMaterial(file);
    const material = await prisma.teacherMaterial.create({
      data: {
        teacherId,
        branchId,
        title: typeof title === "string" && title.trim() ? title.trim() : file.name,
        fileUrl,
        fileType,
        sizeLabel,
      },
    });

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("material_upload_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Materyal yüklenemedi." }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/materials", handleGet);
export const POST = withApiLogging("POST /api/materials", handlePost);
