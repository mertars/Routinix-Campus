import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfPaymentReceipt } from "@/components/pdf/pdf-payment-receipt";
import { amountToTurkishWords, ensureReceiptNo } from "@/lib/server/payments/receipt-service";

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };

export type ReceiptResult =
  | { ok: true; buffer: Buffer; receiptNo: number; studentName: string }
  | { ok: false; status: number; error: string };

// Makbuz PDF'i üretimi — hem YÖNETİCİ hem VELİ tarafından çağrılır.
// YETKİ KONTROLÜ YAPMAZ: çağıran taraf (route) ödemeye erişim hakkını
// KENDİ doğrulamalıdır (yönetici: requireInstitution, veli:
// assertParentOwnsStudent). Bu ayrım bilinçli — belge üretimi ile
// yetkilendirme karışırsa, ikisinden biri değişince diğeri sessizce
// yanlış davranabilir.
export async function renderReceipt(paymentId: string): Promise<ReceiptResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
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
  if (!payment) return { ok: false, status: 404, error: "Tahsilat bulunamadı." };
  // İptal edilmiş bir tahsilatın makbuzu KESİLEMEZ — belge, olmayan bir
  // ödemeyi kanıtlıyormuş gibi görünürdü.
  if (payment.status !== "COMPLETED") {
    return { ok: false, status: 400, error: "Yalnızca tamamlanmış tahsilatlar için makbuz kesilebilir." };
  }

  const receiptNo = await ensureReceiptNo(payment.id, payment.institutionId, payment.receiptNo);
  const amount = Number(payment.amount);
  const parent = payment.student.parents[0]?.parent;

  const buffer = await renderToBuffer(
    PdfPaymentReceipt({
      institutionName: payment.institution.name,
      logoUrl: payment.institution.logoUrl,
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

  return {
    ok: true,
    buffer: buffer as Buffer,
    receiptNo,
    studentName: `${payment.student.firstName} ${payment.student.lastName}`,
  };
}
