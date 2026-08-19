import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const branchId = request.nextUrl.searchParams.get("branchId");
    if (!branchId) return NextResponse.json({ error: "branchId parametresi zorunludur." }, { status: 400 });
    const notes = await prisma.classbookNote.findMany({ where: { branchId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ notes });
  } catch (error) {
    logger.error("classbook_notes_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, branchId, note } = body as { teacherId?: string; branchId?: string; note?: string };
    if (!teacherId || !branchId || !note?.trim()) {
      return NextResponse.json({ error: "teacherId, branchId ve note zorunludur." }, { status: 400 });
    }
    const created = await prisma.classbookNote.create({ data: { teacherId, branchId, note: note.trim() } });
    return NextResponse.json({ note: created }, { status: 201 });
  } catch (error) {
    logger.error("classbook_note_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/classbook-notes", handleGet);
export const POST = withApiLogging("POST /api/classbook-notes", handlePost);
