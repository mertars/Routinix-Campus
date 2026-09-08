import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";

export const dynamic = "force-dynamic";

// POST /api/payments/principal/installments/[id]/postpone — { newDueDate, reason }
// Tek taksitin vadesini öteler. Tutar DEĞİŞMEZ — sadece vade kayar; borç
// silinmez, ileri tarihe taşınır. Gerekçe zorunlu (denetim izi).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const installment = await prisma.installment.findUnique({
      where: { id: params.id },
      select: { institutionId: true, studentId: true, status: true, dueDate: true, amount: true, title: true },
    });
    if (!installment) return NextResponse.json({ error: "Taksit bulunamadı." }, { status: 404 });
    requireInstitution(session, installment.institutionId);
    if (installment.status === "PAID") return NextResponse.json({ error: "Ödenmiş taksit ertelenemez." }, { status: 400 });
    if (installment.status === "CANCELLED") return NextResponse.json({ error: "İptal edilmiş taksit ertelenemez." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const newDueDate = body?.newDueDate ? new Date(body.newDueDate) : null;
    const reason = (body?.reason as string | undefined)?.trim();
    if (!newDueDate || Number.isNaN(newDueDate.getTime())) return NextResponse.json({ error: "Geçerli bir yeni vade tarihi gerekli." }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "Erteleme gerekçesi zorunludur." }, { status: 400 });
    // Geriye erteleme anlamsızdır — vade ileri alınır.
    if (newDueDate <= installment.dueDate) {
      return NextResponse.json({ error: "Yeni vade, mevcut vadeden ileri bir tarih olmalı." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.installment.update({ where: { id: params.id }, data: { dueDate: newDueDate } }),
      prisma.installmentAdjustment.create({
        data: {
          institutionId: session.institutionId,
          studentId: installment.studentId,
          installmentId: params.id,
          type: "POSTPONE",
          previousDueDate: installment.dueDate,
          newDueDate,
          amount: installment.amount,
          reason,
          createdByAdminId: session.sub,
        },
      }),
    ]);

    await recordPaymentAudit({
      session,
      action: "INSTALLMENT_POSTPONED",
      targetType: "Installment",
      targetId: params.id,
      amount: Number(installment.amount),
      summary: `${installment.title} · ${installment.dueDate.toLocaleDateString("tr-TR")} → ${newDueDate.toLocaleDateString("tr-TR")}`,
      metadata: { reason, studentId: installment.studentId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("installment_postpone_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/payments/principal/installments/[id]/postpone", handlePost);
