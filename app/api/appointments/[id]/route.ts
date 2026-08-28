import { NextRequest, NextResponse } from "next/server";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getTeacherDaySlots } from "@/lib/server/etut/get-teacher-day-slots";
import { withApiLogging, logger } from "@/lib/logger";

const VALID_STATUSES = new Set<AppointmentStatus>(["APPROVED", "REJECTED"]);

// PATCH /api/appointments/:id — SADECE randevunun atandığı öğretmen talebi
// onaylar/reddeder.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json();
    const status = (body as { status?: AppointmentStatus }).status;
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "status 'APPROVED' veya 'REJECTED' olmalı." }, { status: 400 });
    }

    const existing = await prisma.appointmentRequest.findUnique({ where: { id: params.id } });
    if (!existing || existing.teacherId !== session.sub) {
      return NextResponse.json({ error: "Randevu talebi bulunamadı." }, { status: 404 });
    }

    if (status === "APPROVED") {
      // Bu talebin kendisini "dolu" saymadan (excludeRequestId) o gün hâlâ
      // mola-tamponuyla müsait mi diye yeniden doğrula — normalde PENDING
      // talep zaten oluşturulduğu anda çakışmaları önlediği için bu bir
      // yarış durumuna karşı savunma katmanıdır.
      const stillAvailable = await getTeacherDaySlots(session.institutionId, existing.teacherId, existing.day, existing.id);
      if (!stillAvailable.includes(existing.slot)) {
        return NextResponse.json({ error: "Bu saat artık müsait değil (başka bir randevuyla çakışıyor)." }, { status: 409 });
      }
    }

    const appointment = await prisma.appointmentRequest.update({
      where: { id: params.id },
      data: { status, decidedAt: new Date() },
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("appointment_decide_failed", { appointmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/appointments/[id]", handlePatch);
