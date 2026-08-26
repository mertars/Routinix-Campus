import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/lesson-slots?teacherId=X  veya  ?branchId=X  veya (parametresiz,
// SADECE yönetici) TÜM kurum programı — Çakışmasız Ders Programı'nın ana
// kaynağı. Öğretmen/öğrenci panelindeki "Haftalık Program" sekmeleri de aynı
// tabloyu, kendi kapsamına göre süzerek okur.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    const teacherId = request.nextUrl.searchParams.get("teacherId");
    const branchId = request.nextUrl.searchParams.get("branchId");

    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
      if (!teacher || teacher.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
      }
    } else if (branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
      if (!branch || branch.institutionId !== session.institutionId) {
        return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
      }
    } else {
      requireRole(session, "principal");
    }

    const slots = await prisma.lessonSlot.findMany({
      where: {
        ...(teacherId ? { teacherId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(teacherId || branchId ? {} : { branch: { institutionId: session.institutionId } }),
      },
      include: { teacher: { select: { firstName: true, lastName: true } } },
    });

    return NextResponse.json({
      slots: slots.map((s) => ({
        id: s.id,
        branchId: s.branchId,
        day: s.day,
        slot: s.slot,
        subject: s.subject,
        teacherId: s.teacherId,
        teacherName: `${s.teacher.firstName} ${s.teacher.lastName}`,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("lesson_slots_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/lesson-slots — yönetici bir öğretmeni bir şube+gün+saate atar.
// Çakışma kontrolü: aynı öğretmen aynı gün+saatte başka bir şubede dersteyse
// veya o saati müsait değil (TeacherUnavailability) olarak işaretlemişse reddedilir.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { branchId, teacherId, subject, day, slot } = body as {
      branchId?: string;
      teacherId?: string;
      subject?: string;
      day?: string;
      slot?: string;
    };
    if (!branchId || !teacherId || !subject?.trim() || !day || !slot) {
      return NextResponse.json({ error: "branchId, teacherId, subject, day ve slot zorunludur." }, { status: 400 });
    }

    const [branchCheck, teacherCheck] = await Promise.all([
      prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } }),
      prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } }),
    ]);
    if (!branchCheck || branchCheck.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }
    if (!teacherCheck || teacherCheck.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Öğretmen bulunamadı." }, { status: 404 });
    }

    const conflict = await prisma.lessonSlot.findFirst({ where: { teacherId, day, slot, branchId: { not: branchId } } });
    if (conflict) {
      const conflictBranch = await prisma.branch.findUnique({ where: { id: conflict.branchId }, select: { name: true } });
      return NextResponse.json(
        { error: `Bu öğretmen bu saatte ${conflictBranch?.name ?? "başka bir şubede"} ders veriyor.` },
        { status: 409 }
      );
    }
    const unavailable = await prisma.teacherUnavailability.findFirst({ where: { teacherId, day, slot } });
    if (unavailable) {
      return NextResponse.json({ error: "Bu öğretmen bu saatte müsait değil." }, { status: 409 });
    }

    const created = await prisma.lessonSlot.upsert({
      where: { branchId_day_slot: { branchId, day, slot } },
      update: { teacherId, subject: subject.trim() },
      create: { branchId, teacherId, subject: subject.trim(), day, slot },
    });

    return NextResponse.json({ slot: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("lesson_slot_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// DELETE /api/lesson-slots?branchId=X&day=Y&slot=Z
async function handleDelete(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const branchId = request.nextUrl.searchParams.get("branchId");
    const day = request.nextUrl.searchParams.get("day");
    const slot = request.nextUrl.searchParams.get("slot");
    if (!branchId || !day || !slot) {
      return NextResponse.json({ error: "branchId, day ve slot parametreleri zorunludur." }, { status: 400 });
    }
    const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { institutionId: true } });
    if (!branch || branch.institutionId !== session.institutionId) {
      return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 });
    }
    await prisma.lessonSlot.deleteMany({ where: { branchId, day, slot } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("lesson_slot_delete_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/lesson-slots", handleGet);
export const POST = withApiLogging("POST /api/lesson-slots", handlePost);
export const DELETE = withApiLogging("DELETE /api/lesson-slots", handleDelete);
