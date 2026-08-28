import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_DAYS = new Set(["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"]);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function canManage(session: { role: string; sub: string }, teacherId: string) {
  return (session.role === "TEACHER" && session.sub === teacherId) || session.role === "ADMIN";
}

// GET /api/teacher-etut-availability?teacherId=X — o öğretmenin etüt
// aralıklarını ve mola süresini döner. Kurum içi herkes okuyabilir (öğrenci
// randevu alırken, öğretmen kendi ayarını düzenlerken) — bkz. eski
// teacher-availability ucuyla AYNI açıklık kararı.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    if (!teacherId) return NextResponse.json({ error: "teacherId zorunludur." }, { status: 400 });

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true, etutBreakMinutes: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    const ranges = await prisma.teacherEtutAvailability.findMany({
      where: { teacherId },
      orderBy: [{ day: "asc" }, { startTime: "asc" }],
      select: { id: true, day: true, startTime: true, endTime: true },
    });

    return NextResponse.json({ ranges, breakMinutes: teacher.etutBreakMinutes });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_etut_availability_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/teacher-etut-availability — { teacherId, day, startTime, endTime }
// yeni bir müsaitlik aralığı ekler. Aynı gün içindeki aralıklarla ÖRTÜŞEMEZ
// (algoritma örtüşmeyen aralıklar varsayar — bkz. compute-available-slots.ts).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { teacherId, day, startTime, endTime } = body as { teacherId?: string; day?: string; startTime?: string; endTime?: string };

    if (!teacherId || !day || !startTime || !endTime) {
      return NextResponse.json({ error: "teacherId, day, startTime ve endTime zorunludur." }, { status: 400 });
    }
    if (!VALID_DAYS.has(day)) return NextResponse.json({ error: "Geçersiz gün." }, { status: 400 });
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return NextResponse.json({ error: "Saat formatı HH:MM olmalı." }, { status: 400 });
    }
    if (startTime >= endTime) {
      return NextResponse.json({ error: "Bitiş saati başlangıçtan sonra olmalı." }, { status: 400 });
    }
    if (!canManage(session, teacherId)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    const existing = await prisma.teacherEtutAvailability.findMany({ where: { teacherId, day } });
    const overlaps = existing.some((r) => startTime < r.endTime && endTime > r.startTime);
    if (overlaps) {
      return NextResponse.json({ error: "Bu aralık, aynı gün için zaten girilmiş bir aralıkla örtüşüyor." }, { status: 409 });
    }

    const range = await prisma.teacherEtutAvailability.create({ data: { teacherId, day, startTime, endTime } });
    return NextResponse.json({ range }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_etut_availability_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// PATCH /api/teacher-etut-availability — { teacherId, breakMinutes } — öğretmenin
// etütler arası mola süresini günceller (aralık bazında değil, öğretmen bazında).
async function handlePatch(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const { teacherId, breakMinutes } = body as { teacherId?: string; breakMinutes?: unknown };
    const minutes = Number(breakMinutes);

    if (!teacherId || !Number.isFinite(minutes) || minutes < 0 || minutes > 60) {
      return NextResponse.json({ error: "teacherId zorunlu, breakMinutes 0-60 arasında olmalı." }, { status: 400 });
    }
    if (!canManage(session, teacherId)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
    if (!teacher || teacher.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    await prisma.teacher.update({ where: { id: teacherId }, data: { etutBreakMinutes: minutes } });
    return NextResponse.json({ ok: true, breakMinutes: minutes });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_etut_break_update_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/teacher-etut-availability", handleGet);
export const POST = withApiLogging("POST /api/teacher-etut-availability", handlePost);
export const PATCH = withApiLogging("PATCH /api/teacher-etut-availability", handlePatch);
