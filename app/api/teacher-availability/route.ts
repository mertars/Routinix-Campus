import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/teacher-availability?teacherId=X — öğretmenin bloke ettiği
// (etüt ALAMAYACAĞI) gün+saatler. Bunun dışındaki her saat, o an başka bir
// onaylı randevuyla dolu olmadığı sürece müsaittir. Kurum içindeki herhangi
// bir oturum okuyabilir (öğrenci randevu alırken müsaitliği kontrol eder).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) {
      return NextResponse.json({ error: "teacherId parametresi zorunludur." }, { status: 400 });
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }
    const blocks = await prisma.teacherUnavailability.findMany({ where: { teacherId }, select: { day: true, slot: true } });
    return NextResponse.json({ blocks });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_availability_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/teacher-availability — öğretmen bir saati bloke eder/bloke
// kaldırır. Body: { teacherId, day, slot, unavailable: boolean }. Sadece
// öğretmenin kendisi ya da bir yönetici değiştirebilir.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { teacherId, day, slot, unavailable } = body as { teacherId?: string; day?: string; slot?: string; unavailable?: boolean };
    if (!teacherId || !day || !slot || typeof unavailable !== "boolean") {
      return NextResponse.json({ error: "teacherId, day, slot ve unavailable (boolean) zorunludur." }, { status: 400 });
    }
    if (session.role === "TEACHER") {
      if (session.sub !== teacherId) throw new AuthError("Kayıt bulunamadı.", "NOT_FOUND", 404);
    } else {
      requireRole(session, "principal");
    }
    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    if (unavailable) {
      await prisma.teacherUnavailability.upsert({
        where: { teacherId_day_slot: { teacherId, day, slot } },
        update: {},
        create: { teacherId, day, slot },
      });
    } else {
      await prisma.teacherUnavailability.deleteMany({ where: { teacherId, day, slot } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_availability_toggle_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teacher-availability", handleGet);
export const POST = withApiLogging("POST /api/teacher-availability", handlePost);
