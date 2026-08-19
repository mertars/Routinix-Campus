import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// Müfredat konu ağacının kendisi (CURRICULUM_TREE) statik referans içerik
// olarak lib/mock-data.ts'te kalır. Burada sadece "hangi şube hangi alt
// konuyu işledi" durumu tutulur — öğretmenin Sınıf Defteri'nde işaretlediği
// ilerleme, öğrencinin Haftalık Program'ındaki "Müfredat Durumu" ile AYNI
// gerçek veriyi (branşa göre) gösterir.
async function handleGet(request: NextRequest) {
  try {
    const branchId = request.nextUrl.searchParams.get("branchId");
    if (!branchId) return NextResponse.json({ error: "branchId parametresi zorunludur." }, { status: 400 });
    const rows = await prisma.curriculumProgress.findMany({ where: { branchId }, select: { subtopicId: true, covered: true } });
    return NextResponse.json({ progress: rows });
  } catch (error) {
    logger.error("curriculum_progress_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { branchId, subject, subtopicId, covered } = body as {
      branchId?: string;
      subject?: string;
      subtopicId?: string;
      covered?: boolean;
    };
    if (!branchId || !subject || !subtopicId || typeof covered !== "boolean") {
      return NextResponse.json({ error: "branchId, subject, subtopicId ve covered (boolean) zorunludur." }, { status: 400 });
    }
    await prisma.curriculumProgress.upsert({
      where: { branchId_subtopicId: { branchId, subtopicId } },
      update: { covered, coveredAt: covered ? new Date() : null },
      create: { branchId, subject, subtopicId, covered, coveredAt: covered ? new Date() : null },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("curriculum_progress_toggle_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/curriculum-progress", handleGet);
export const POST = withApiLogging("POST /api/curriculum-progress", handlePost);
