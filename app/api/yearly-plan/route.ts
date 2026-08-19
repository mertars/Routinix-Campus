import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

async function handleGet(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    const rows = await prisma.yearlyPlanRow.findMany({ where: { teacherId }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ rows });
  } catch (error) {
    logger.error("yearly_plan_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

async function handlePost(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, weekLabel, subtopicName, notes } = body as {
      teacherId?: string;
      weekLabel?: string;
      subtopicName?: string;
      notes?: string;
    };
    if (!teacherId || !weekLabel?.trim() || !subtopicName?.trim()) {
      return NextResponse.json({ error: "teacherId, weekLabel ve subtopicName zorunludur." }, { status: 400 });
    }
    const created = await prisma.yearlyPlanRow.create({
      data: { teacherId, weekLabel: weekLabel.trim(), subtopicName: subtopicName.trim(), notes: notes?.trim() || null },
    });
    return NextResponse.json({ row: created }, { status: 201 });
  } catch (error) {
    logger.error("yearly_plan_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/yearly-plan", handleGet);
export const POST = withApiLogging("POST /api/yearly-plan", handlePost);
