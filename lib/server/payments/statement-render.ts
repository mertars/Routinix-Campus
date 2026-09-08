import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/server/prisma";
import { PdfStudentStatement } from "@/components/pdf/pdf-student-statement";
import { DISCOUNT_TYPE_LABEL } from "@/lib/server/payments/discount-service";

const METHOD_LABEL: Record<string, string> = { CASH: "Nakit", BANK_TRANSFER: "Havale/EFT", CREDIT_CARD: "Kredi Kartı" };
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  PARTIALLY_PAID: "Kısmi",
  PAID: "Ödendi",
  CANCELLED: "İptal",
};

function tl(n: number): string {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

function d(date: Date): string {
  return date.toLocaleDateString("tr-TR");
}

export type StatementResult =
  | { ok: true; buffer: Buffer; studentName: string; studentNumber: string }
  | { ok: false; status: number; error: string };

// Öğrenci cari ekstresi PDF'i — hem YÖNETİCİ hem VELİ tarafından çağrılır.
// YETKİ KONTROLÜ YAPMAZ; çağıran route kendi doğrular (bkz. receipt-render
// içindeki aynı gerekçe).
//
// Makbuzun aksine bu belge SALT OKUNUR: hiçbir alan üretmez/yazmaz, bu
// yüzden sıralama açısından da riski yoktur.
export async function renderStatement(studentId: string): Promise<StatementResult> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      firstName: true,
      lastName: true,
      studentNumber: true,
      branch: { select: { name: true } },
      parents: { include: { parent: { select: { firstName: true, lastName: true } } }, take: 1 },
      institution: { select: { name: true, logoUrl: true } },
    },
  });
  if (!student) return { ok: false, status: 404, error: "Öğrenci bulunamadı." };

  const [installments, payments, discounts, cancellations] = await Promise.all([
    // İptal edilen taksitler ekstreye GİRMEZ — veli için "borcum ne" sorusu
    // yalnızca yaşayan taksitlerle ilgilidir (kayıt iptali sonrası eski
    // taksitler tabloyu kirletirdi).
    prisma.installment.findMany({
      where: { studentId, status: { not: "CANCELLED" } },
      orderBy: { dueDate: "asc" },
      include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
    }),
    prisma.payment.findMany({
      where: { studentId, status: "COMPLETED" },
      orderBy: { paidAt: "asc" },
      include: { installment: { select: { title: true } } },
    }),
    // Yalnızca bir plana GERÇEKTEN uygulanmış indirimler. isActive'e
    // bakılmaz: indirim sonradan pasifleştirilse bile o plandaki tutar
    // gerçekten indirilmişti, ekstre olan biteni anlatmalı.
    prisma.studentDiscount.findMany({
      where: { studentId, appliedAt: { not: null } },
      select: { type: true, appliedDiscount: true },
    }),
    // İadeler ekstrede GÖRÜNMEK ZORUNDA: iptal edilmiş taksitler plandan
    // çıkarıldığı için, iade yazılmazsa belge "tüm para kurumda kaldı"
    // izlenimi verir — veliye verilen bir belgede bu yanıltıcıdır.
    prisma.enrollmentCancellation.findMany({
      where: { studentId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, reason: true, cancelledInstallmentCount: true, cancelledAmount: true, refundAmount: true },
    }),
  ]);

  const now = new Date();
  let planTotal = 0;
  // Yaşayan taksitlere yapılmış ödeme — KALAN BORCU bu düşürür.
  let installmentPaid = 0;
  let overdueTotal = 0;

  const installmentRows = installments.map((inst) => {
    const amount = Number(inst.amount);
    const paid = inst.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = Math.round((amount - paid) * 100) / 100;
    const isOverdue = inst.status !== "PAID" && inst.dueDate < now && remaining > 0;

    planTotal += amount;
    installmentPaid += paid;
    if (isOverdue) overdueTotal += remaining;

    return {
      dueDate: d(inst.dueDate),
      title: inst.title,
      amount: tl(amount),
      paid: tl(paid),
      remaining: tl(remaining),
      statusLabel: STATUS_LABEL[inst.status] ?? inst.status,
      isOverdue,
    };
  });

  planTotal = Math.round(planTotal * 100) / 100;
  installmentPaid = Math.round(installmentPaid * 100) / 100;
  overdueTotal = Math.round(overdueTotal * 100) / 100;
  const remainingTotal = Math.round((planTotal - installmentPaid) * 100) / 100;

  // Kurumun bu öğrenciden aldığı TÜM para. Serbest tahsilatları ve iptal
  // edilmiş bir taksite yapılmış ödemeleri de içerir; bu yüzden taksit
  // tablosundaki "ödenen" toplamından BÜYÜK olabilir. İkisi bilerek
  // ayrıştırıldı: biri "borcum ne kadar azaldı", diğeri "ne kadar ödedim".
  const collectedTotal =
    Math.round(payments.reduce((sum, p) => sum + Number(p.amount), 0) * 100) / 100;

  const discountTotal = discounts.reduce((sum, x) => sum + Number(x.appliedDiscount ?? 0), 0);
  const discountTypes =
    discounts.length > 0 ? [...new Set(discounts.map((x) => DISCOUNT_TYPE_LABEL[x.type] ?? x.type))].join(", ") : null;

  const refundTotal = Math.round(cancellations.reduce((sum, c) => sum + Number(c.refundAmount), 0) * 100) / 100;

  const parent = student.parents[0]?.parent;

  const buffer = await renderToBuffer(
    PdfStudentStatement({
      institutionName: student.institution.name,
      logoUrl: student.institution.logoUrl,
      generatedAt: d(now),
      studentName: `${student.firstName} ${student.lastName}`,
      studentNo: student.studentNumber,
      branchName: student.branch.name,
      parentName: parent ? `${parent.firstName} ${parent.lastName}` : null,
      planTotal: tl(planTotal),
      discountTotal: discountTypes ? tl(discountTotal) : null,
      discountTypes,
      collectedTotal: tl(collectedTotal),
      installmentPaidTotal: tl(installmentPaid),
      remainingTotal: tl(remainingTotal),
      overdueTotal: tl(overdueTotal),
      hasOverdue: overdueTotal > 0,
      refundTotal: refundTotal > 0 ? tl(refundTotal) : null,
      netCollectedTotal: refundTotal > 0 ? tl(Math.round((collectedTotal - refundTotal) * 100) / 100) : null,
      cancellations: cancellations.map((c) => ({
        date: d(c.createdAt),
        reason: c.reason,
        cancelledCount: String(c.cancelledInstallmentCount),
        cancelledAmount: tl(Number(c.cancelledAmount)),
        refundAmount: tl(Number(c.refundAmount)),
      })),
      installments: installmentRows,
      payments: payments.map((p) => ({
        paidAt: d(p.paidAt),
        receiptNo: p.receiptNo ? `${p.paidAt.getFullYear()}-${String(p.receiptNo).padStart(6, "0")}` : "—",
        title: p.installment?.title ?? "Serbest tahsilat",
        method: METHOD_LABEL[p.method] ?? p.method,
        amount: tl(Number(p.amount)),
      })),
    })
  );

  return {
    ok: true,
    buffer: buffer as Buffer,
    studentName: `${student.firstName} ${student.lastName}`,
    studentNumber: student.studentNumber,
  };
}
