import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { renderReceipt } from "@/lib/server/payments/receipt-render";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/payments/[id]/receipt — tahsilat makbuzu PDF'i
// (A5, veli + kurum nüshası tek sayfada).
//
// Belgenin kendisi renderReceipt() içinde üretilir; burada YALNIZCA yetki
// kontrolü var. Aynı belge veli tarafından da indirilebilir
// (/api/payments/parent/receipt/[id]) — orada kontrol sahiplik üzerinden.
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const owner = await prisma.payment.findUnique({ where: { id: params.id }, select: { institutionId: true } });
    if (!owner) return NextResponse.json({ error: "Tahsilat bulunamadı." }, { status: 404 });
    requireInstitution(session, owner.institutionId);

    const result = await renderReceipt(params.id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return new NextResponse(result.buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="makbuz-${result.receiptNo}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("payment_receipt_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/payments/[id]/receipt", handleGet);
