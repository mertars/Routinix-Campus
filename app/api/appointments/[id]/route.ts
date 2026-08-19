import { NextRequest, NextResponse } from "next/server";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { withApiLogging, logger } from "@/lib/logger";

const VALID_STATUSES = new Set<AppointmentStatus>(["APPROVED", "REJECTED"]);

// PATCH /api/appointments/:id — öğretmen randevu talebini onaylar/reddeder.
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const status = (body as { status?: AppointmentStatus }).status;
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: "status 'APPROVED' veya 'REJECTED' olmalı." }, { status: 400 });
    }

    const existing = await prisma.appointmentRequest.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: "Randevu talebi bulunamadı." }, { status: 404 });

    if (status === "APPROVED") {
      const conflict = await prisma.appointmentRequest.findFirst({
        where: { teacherId: existing.teacherId, day: existing.day, slot: existing.slot, status: "APPROVED", id: { not: existing.id } },
      });
      if (conflict) {
        return NextResponse.json({ error: "Bu saat için zaten onaylanmış başka bir randevu var." }, { status: 409 });
      }
    }

    const appointment = await prisma.appointmentRequest.update({
      where: { id: params.id },
      data: { status, decidedAt: new Date() },
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    logger.error("appointment_decide_failed", { appointmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/appointments/[id]", handlePatch);
