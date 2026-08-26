import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/teacher-duty-slots?teacherId=X — öğretmenin nöbet saatleri
// (Haftalık Program sekmesindeki mor "Nöbet" hücreleri). Sadece öğretmenin
// kendisi ya da bir yönetici görebilir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    if (session.role === "TEACHER") {
      if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    } else {
      requireRole(session, "principal");
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }
    const slots = await prisma.teacherDutySlot.findMany({ where: { teacherId } });
    return NextResponse.json({ slots });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_duty_slots_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teacher-duty-slots", handleGet);
