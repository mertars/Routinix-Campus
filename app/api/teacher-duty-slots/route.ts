import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/teacher-duty-slots?teacherId=X — öğretmenin nöbet saatleri
// (Haftalık Program sekmesindeki mor "Nöbet" hücreleri).
async function handleGet(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    const slots = await prisma.teacherDutySlot.findMany({ where: { teacherId } });
    return NextResponse.json({ slots });
  } catch (error) {
    logger.error("teacher_duty_slots_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teacher-duty-slots", handleGet);
