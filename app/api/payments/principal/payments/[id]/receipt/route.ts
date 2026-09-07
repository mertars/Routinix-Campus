import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { PdfPaymentReceipt } from "@/components/pdf/pdf-payment-receipt";
import { amountToTurkishWords, ensureReceiptNo } from "@/lib/server/payments/receipt-service";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };

// GET /api/payments/principal/payments/[id]/receipt — tahsilat makbuzu PDF'i
// (A5, veli + kurum nüshası tek sayfada).
async function handleGet(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const payment = await prisma.payment.findUnique({
      where: { id: params.id },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            branch: { select: { name: true } },
            parents: { include: { parent: { select: { firstName: true, lastName: true } } }, take: 1 },
          },
        },
        installment: { select: { title: true } },
        account: { select: { name: true } },
        recordedByAdmin: { select: { firstName: true, lastName: true } },
        institution: { select: { name: true, logoUrl: true } },
      },
    });
    if (!payment) return NextResponse.json({ error: "Tahsilat bulunamadı." }, { status: 404 });
    requireInstitution(session, payment.institutionId);
    if (payment.status !== "COMPLETED") {
      return NextResponse.json({ error: "Yalnızca tamamlanmış tahsilatlar için makbuz kesilebilir." }, { status: 400 });
    }

    const receiptNo = await ensureReceiptNo(payment.id, payment.institutionId, payment.receiptNo);
    const amount = Number(payment.amount);
    const parent = payment.student.parents[0]?.parent;

    const buffer = await renderToBuffer(
      PdfPaymentReceipt({
        institutionName: payment.institution.name,
        logoUrl: payment.institution.logoUrl,
        // İnsan-okur, yıl önekli numara: 2026-000123
        receiptNo: `${payment.paidAt.getFullYear()}-${String(receiptNo).padStart(6, "0")}`,
        paidAt: payment.paidAt.toLocaleDateString("tr-TR"),
        studentName: `${payment.student.firstName} ${payment.student.lastName}`,
        branchName: payment.student.branch.name,
        parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
        installmentTitle: payment.installment?.title ?? "Serbest tahsilat",
        amountFigure: amount.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }),
        amountWords: amountToTurkishWords(amount),
        methodLabel: METHOD_LABEL[payment.method] ?? payment.method,
        accountName: payment.account.name,
        collectedBy: `${payment.recordedByAdmin.firstName} ${payment.recordedByAdmin.lastName}`,
        note: payment.note,
      })
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="makbuz-${receiptNo}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payment_receipt_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/payments/[id]/receipt", handleGet);
