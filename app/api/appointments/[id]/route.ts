import { NextRequest, NextResponse } from "next/server";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { getTeacherDaySlots } from "@/lib/server/etut/get-teacher-day-slots";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging, logger } from "@/lib/logger";

const DECISION_STATUSES = new Set<AppointmentStatus>(["APPROVED", "REJECTED"]);
// Onaylanmış bir etüt GERÇEKLEŞTİKTEN SONRA geriye dönük işaretlenir —
// kullanıcı talebi: "yapıldı/yapılmadı olarak işaretleme, yapılmadıysa
// açıklama yazılsın, yönetici paneline gönderilsin."
const COMPLETION_STATUSES = new Set<AppointmentStatus>(["COMPLETED", "NO_SHOW"]);

// PATCH /api/appointments/:id — SADECE randevunun atandığı öğretmen, İKİ
// AYRI geçiş yapabilir: (1) PENDING→APPROVED/REJECTED (talep kararı), (2)
// APPROVED→COMPLETED/NO_SHOW (gerçekleşme kaydı, sadece onaylanmış bir
// randevu için anlamlı).
async function handlePatch(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");

    const body = await request.json();
    const status = (body as { status?: AppointmentStatus }).status;
    const completionNote = typeof (body as { completionNote?: unknown })?.completionNote === "string" ? (body as { completionNote: string }).completionNote.trim() : "";

    if (!status || !(DECISION_STATUSES.has(status) || COMPLETION_STATUSES.has(status))) {
      return NextResponse.json({ error: "Geçersiz status." }, { status: 400 });
    }
    if (status === "NO_SHOW" && !completionNote) {
      return NextResponse.json({ error: "\"Yapılmadı\" için kısa bir açıklama zorunludur." }, { status: 400 });
    }

    const existing = await prisma.appointmentRequest.findUnique({ where: { id: params.id } });
    if (!existing || existing.teacherId !== session.sub) {
      return NextResponse.json({ error: "Randevu talebi bulunamadı." }, { status: 404 });
    }

    if (COMPLETION_STATUSES.has(status) && existing.status !== "APPROVED") {
      return NextResponse.json({ error: "Sadece onaylanmış bir etüt tamamlandı/yapılmadı olarak işaretlenebilir." }, { status: 400 });
    }

    if (COMPLETION_STATUSES.has(status)) {
      const appointment = await prisma.appointmentRequest.update({
        where: { id: params.id },
        data: { status, completedAt: new Date(), completionNote: status === "NO_SHOW" ? completionNote : null },
      });
      await recordAuditLog({
        institutionId: session.institutionId,
        actorId: session.sub,
        actorRole: session.role,
        action: "APPOINTMENT_COMPLETION_RECORDED",
        targetType: "AppointmentRequest",
        targetId: params.id,
        metadata: { status, completionNote: status === "NO_SHOW" ? completionNote : undefined },
      });
      return NextResponse.json({ appointment });
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
