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
//
// GET ?teacherIds=A,B,C — TOPLU biçim (ör. schedule-matrix.tsx'in ders
// programı ızgarası tüm öğretmenlerin müsaitliğini aynı anda gösterir).
// Önceden her öğretmen için ayrı bir istek atılıyordu (N öğretmen = N
// round-trip); tek sorguda tüm bloke kayıtları teacherId etiketiyle döner.
// Tekil ?teacherId= davranışı DEĞİŞMEDİ — geriye dönük tam uyumlu.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const teacherIdsParam = request.nextUrl.searchParams.get("teacherIds");

    if (teacherIdsParam) {
      const ids = teacherIdsParam.split(",").map((id) => id.trim()).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ blocks: [] });
      const validCount = await prisma.teacher.count({ where: { id: { in: ids }, institutionId: session.institutionId } });
      if (validCount !== ids.length) {
        return NextResponse.json({ error: "Bir veya daha fazla öğretmen bulunamadı." }, { status: 404 });
      }
      const blocks = await prisma.teacherUnavailability.findMany({
        where: { teacherId: { in: ids } },
        select: { teacherId: true, day: true, slot: true },
      });
      return NextResponse.json({ blocks });
    }

    if (!teacherId) {
      return NextResponse.json({ error: "teacherId ya da teacherIds parametresi zorunludur." }, { status: 400 });
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
