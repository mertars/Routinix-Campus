import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";

export const dynamic = "force-dynamic";

// POST /api/payments/principal/payments/[id]/void — { reason }
//
// Hatalı tahsilat kaydını İPTAL eder. Kayıt SİLİNMEZ (muhasebe izi
// kaybolmamalı): status=VOIDED yapılır, kim/ne zaman/neden bilgisi
// yazılır. Tüm bakiye/rapor/yaşlandırma sorguları status="COMPLETED"
// filtrelediği için iptal edilen tahsilat oralardan kendiliğinden düşer.
//
// Bağlı taksitin durumu YENİDEN HESAPLANIR — aksi halde tahsilatı iptal
// edilmiş bir taksit "Ödendi" görünmeye devam eder ve borç kaybolurdu.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      select: {
        institutionId: true,
        status: true,
        installmentId: true,
        amount: true,
        studentId: true,
        student: { select: { firstName: true, lastName: true } },
      },
    });
    if (!payment) return NextResponse.json({ error: "Tahsilat bulunamadı." }, { status: 404 });
    requireInstitution(session, payment.institutionId);
    if (payment.status === "VOIDED") return NextResponse.json({ error: "Bu tahsilat zaten iptal edilmiş." }, { status: 400 });
    if (payment.status !== "COMPLETED") {
      return NextResponse.json({ error: "Yalnızca tamamlanmış tahsilatlar iptal edilebilir." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const reason = (body?.reason as string | undefined)?.trim();
    // Gerekçe ZORUNLU — denetim izinin anlamı gerekçeden gelir.
    if (!reason) return NextResponse.json({ error: "İptal gerekçesi zorunludur." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: params.id },
        data: { status: "VOIDED", voidedAt: new Date(), voidReason: reason, voidedByAdminId: session.sub },
      });

      if (payment.installmentId) {
        const installment = await tx.installment.findUnique({
          where: { id: payment.installmentId },
          select: { amount: true, status: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        });
        if (installment && installment.status !== "CANCELLED") {
          const paid = installment.payments.reduce((sum, p) => sum + Number(p.amount), 0);
          const total = Number(installment.amount);
          const nextStatus = paid >= total - 0.009 ? "PAID" : paid > 0.009 ? "PARTIALLY_PAID" : "PENDING";
          await tx.installment.update({ where: { id: payment.installmentId }, data: { status: nextStatus } });
        }
      }
    });

    await recordPaymentAudit({
      session,
      action: "PAYMENT_VOIDED",
      targetType: "Payment",
      targetId: params.id,
      amount: Number(payment.amount),
      summary: `${payment.student.firstName} ${payment.student.lastName} · ${reason}`,
      metadata: { reason, studentId: payment.studentId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_void_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/payments/principal/payments/[id]/void", handlePost);
