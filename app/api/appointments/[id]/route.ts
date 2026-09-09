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

    // Onay bir İŞLEM içinde ve KİLİTLE yapılır.
    //
    // Onay aşamasında yalnızca ONAYLANMIŞ randevular engeller (bkz.
    // get-teacher-day-slots.ts > pendingBlocks). Bu doğru davranış ama
    // tek başına yeni bir yarış açar: aynı slot için iki bekleyen talep
    // aynı anda onaylanırsa ikisi de "onaylı yok" görüp ikisi de
    // geçerdi — yani gerçek çifte rezervasyon. Önceki hali bunu kazara
    // engelliyordu (bekleyen talepler birbirini bloke ediyordu) ama
    // bedeli öğretmenin HİÇBİRİNİ onaylayamaması oluyordu.
    //
    // Çözüm ödeme tarafındaki desenle aynı: o öğretmenin o güne ait
    // randevu satırları FOR UPDATE ile kilitlenir; ikinci istek
    // birincinin commit'ini bekler ve güncel durumu görür.
    const appointment = await prisma.$transaction(async (tx) => {
      if (status === "APPROVED") {
        await tx.$queryRaw`SELECT id FROM "AppointmentRequest" WHERE "teacherId" = ${existing.teacherId} AND "day" = ${existing.day} FOR UPDATE`;

        const stillAvailable = await getTeacherDaySlots(session.institutionId, existing.teacherId, existing.day, {
          excludeRequestId: existing.id,
          pendingBlocks: false,
        });
        if (!stillAvailable.includes(existing.slot)) return null;
      }

      return tx.appointmentRequest.update({
        where: { id: params.id },
        data: { status, decidedAt: new Date() },
      });
    });

    if (!appointment) {
      return NextResponse.json({ error: "Bu saat artık müsait değil (başka bir randevuyla çakışıyor)." }, { status: 409 });
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("appointment_decide_failed", { appointmentId: params.id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const PATCH = withApiLogging("PATCH /api/appointments/[id]", handlePatch);
