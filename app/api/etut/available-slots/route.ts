import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getTeacherDaySlots } from "@/lib/server/etut/get-teacher-day-slots";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/etut/available-slots?teacherId=X&day=Pazartesi — o öğretmenin o
// gün için ŞU AN rezerve edilebilir slotlarını, kurum etüt süresi + öğretmen
// mola süresi + mevcut (PENDING+APPROVED) randevulara göre DİNAMİK olarak
// hesaplayıp döner (bkz. lib/server/etut/get-teacher-day-slots.ts).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const day = request.nextUrl.searchParams.get("day");
    if (!teacherId || !day) {
      return NextResponse.json({ error: "teacherId ve day zorunludur." }, { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    const slots = await getTeacherDaySlots(session.institutionId, teacherId, day);
    return NextResponse.json({ slots });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("etut_available_slots_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/etut/available-slots", handleGet);
