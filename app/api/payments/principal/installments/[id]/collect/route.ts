import { NextRequest, NextResponse } from "next/server";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { collectPayment, OverCollectionError } from "@/lib/server/payments/collect-service";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

const VALID_METHODS: PaymentMethod[] = ["CASH", "BANK_TRANSFER", "CREDIT_CARD"];

// POST /api/payments/principal/installments/[id]/collect
// { amount, method, accountId, paidAt?, note? } — manuel tahsilat kaydı.
// Faz 1'de source her zaman MANUAL/status her zaman COMPLETED (bkz.
// prisma/schema.prisma > Payment modelinin üstündeki gerekçe — gateway
// eklenince bu route'a dokunmadan yeni bir "online ödeme" akışı eklenir).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const installment = await prisma.installment.findUnique({
      where: { id: params.id },
      include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    });
    if (!installment) return NextResponse.json({ error: "Taksit bulunamadı." }, { status: 404 });
    requireInstitution(session, installment.institutionId);
    if (installment.status === "CANCELLED") return NextResponse.json({ error: "İptal edilmiş bir taksite tahsilat kaydedilemez." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const amount = Number(body?.amount);
    const method = body?.method as PaymentMethod | undefined;
    const accountId = body?.accountId as string | undefined;
    const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date();
    const note = (body?.note as string | undefined)?.trim() || null;

    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif bir sayı olmalı." }, { status: 400 });
    if (!method || !VALID_METHODS.includes(method)) return NextResponse.json({ error: "method geçersiz." }, { status: 400 });
    if (!accountId) return NextResponse.json({ error: "accountId zorunludur." }, { status: 400 });
    if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: "paidAt geçerli bir tarih olmalı." }, { status: 400 });

    const account = await prisma.paymentAccount.findUnique({ where: { id: accountId }, select: { institutionId: true } });
    if (!account || account.institutionId !== session.institutionId) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

    // Kalan tutar kontrolü, makbuz numarası ve kayıt TEK bir kilitli
    // işlemde yapılır (bkz. collect-service) — burada okunan bir "kalan"
    // değeri, kayıt anına kadar bayatlayabilirdi.
    let result;
    try {
      result = await collectPayment({
        institutionId: session.institutionId,
        installmentId: installment.id,
        installmentAmount: Number(installment.amount),
        studentId: installment.studentId,
        accountId,
        amount,
        method,
        paidAt,
        note,
        recordedByAdminId: session.sub,
      });
    } catch (collectError) {
      if (collectError instanceof OverCollectionError) {
        return NextResponse.json({ error: collectError.message }, { status: 400 });
      }
      throw collectError;
    }
    const { payment, receiptNo } = result;

    const student = await prisma.student.findUnique({
      where: { id: installment.studentId },
      select: { firstName: true, lastName: true },
    });
    await recordPaymentAudit({
      session,
      action: "PAYMENT_COLLECTED",
      targetType: "Payment",
      targetId: payment.id,
      amount,
      summary: `${student?.firstName ?? ""} ${student?.lastName ?? ""} · ${installment.title}`.trim(),
      metadata: { method, receiptNo, studentId: installment.studentId },
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("payment_collect_failed", error);
  }
}

export const POST = withApiLogging("POST /api/payments/principal/installments/[id]/collect", handlePost);
