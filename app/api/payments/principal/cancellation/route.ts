import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { computeAccountBalances } from "@/lib/server/payments/account-balance";

export const dynamic = "force-dynamic";

// GET ?studentId= — kayıt iptali önizlemesi.
//
// İade önerisi ŞEFFAF bir orantıyla hesaplanır: plan kaç aya yayılmışsa,
// bugüne kadar KAÇ AYI geçmişse o kadarı "kullanılmış" sayılır. Kalan
// aylara düşen tutar iade adayıdır.
//
//   kullanılan = planToplamı × (geçenAy / toplamAy)
//   önerilen iade = ödenen − kullanılan   (negatifse 0)
//
// Bu bir ÖNERİDİR, kurum politikası (kesinti oranı, cayma bedeli, mevzuat)
// kurumdan kuruma değişir — yönetici rakamı ezebilir. Hesabın parçaları
// ekranda gösterilir ki rakam kara kutu olmasın.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { institutionId: true, firstName: true, lastName: true },
    });
    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const [installments, paidAgg, existing] = await Promise.all([
      prisma.installment.findMany({
        where: { institutionId: session.institutionId, studentId, status: { not: "CANCELLED" } },
        include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.payment.aggregate({ where: { institutionId: session.institutionId, studentId, status: "COMPLETED" }, _sum: { amount: true } }),
      prisma.enrollmentCancellation.findFirst({ where: { institutionId: session.institutionId, studentId }, select: { id: true, createdAt: true } }),
    ]);

    const open = installments.filter((i) => i.status === "PENDING" || i.status === "PARTIALLY_PAID");
    const remainingDebt = Math.round(open.reduce((s, i) => s + (Number(i.amount) - i.payments.reduce((x, p) => x + Number(p.amount), 0)), 0) * 100) / 100;
    const totalPaid = Number(paidAgg._sum.amount ?? 0);
    const planTotal = Math.round(installments.reduce((s, i) => s + Number(i.amount), 0) * 100) / 100;

    // Geçen ay sayısı: ilk taksit vadesinden bugüne. Plan henüz
    // başlamadıysa 0, plan bittiyse toplam ay ile sınırlı.
    const totalMonths = installments.length;
    let elapsedMonths = 0;
    if (totalMonths > 0) {
      const firstDue = installments[0].dueDate;
      const now = new Date();
      const diff = (now.getFullYear() - firstDue.getFullYear()) * 12 + (now.getMonth() - firstDue.getMonth());
      elapsedMonths = Math.min(totalMonths, Math.max(0, diff + 1));
    }
    const consumed = totalMonths > 0 ? Math.round(planTotal * (elapsedMonths / totalMonths) * 100) / 100 : 0;
    const suggestedRefund = Math.max(0, Math.round((totalPaid - consumed) * 100) / 100);

    return NextResponse.json({
      studentName: `${student.firstName} ${student.lastName}`,
      alreadyCancelled: existing ? { id: existing.id, at: existing.createdAt.toISOString() } : null,
      openCount: open.length,
      remainingDebt,
      totalPaid,
      planTotal,
      totalMonths,
      elapsedMonths,
      consumed,
      suggestedRefund,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("cancellation_preview_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { studentId, reason, refundAmount?, refundAccountId? }
// Kalan taksitleri iptal eder; iade varsa kasadan düşer.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    const reason = (body?.reason as string | undefined)?.trim();
    const refundAmount = body?.refundAmount != null ? Number(body.refundAmount) : 0;
    const refundAccountId = (body?.refundAccountId as string | undefined) || null;

    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    if (!reason) return NextResponse.json({ error: "İptal gerekçesi zorunludur." }, { status: 400 });
    if (!Number.isFinite(refundAmount) || refundAmount < 0) return NextResponse.json({ error: "İade tutarı negatif olamaz." }, { status: 400 });
    if (refundAmount > 0 && !refundAccountId) return NextResponse.json({ error: "İade için kasa/banka hesabı seçilmelidir." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student || student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    const [open, paidAgg] = await Promise.all([
      prisma.installment.findMany({
        where: { institutionId: session.institutionId, studentId, status: { in: ["PENDING", "PARTIALLY_PAID"] } },
        include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
      }),
      prisma.payment.aggregate({ where: { institutionId: session.institutionId, studentId, status: "COMPLETED" }, _sum: { amount: true } }),
    ]);

    const totalPaid = Number(paidAgg._sum.amount ?? 0);
    // İade, öğrencinin ÖDEDİĞİNDEN fazla olamaz — aksi halde kurum hiç
    // alınmamış parayı geri vermiş olurdu.
    if (refundAmount > totalPaid + 0.009) {
      return NextResponse.json({ error: `İade tutarı, tahsil edilen toplamı (${totalPaid.toFixed(2)} ₺) aşamaz.` }, { status: 400 });
    }

    if (refundAmount > 0 && refundAccountId) {
      const account = await prisma.paymentAccount.findUnique({ where: { id: refundAccountId }, select: { institutionId: true } });
      if (!account || account.institutionId !== session.institutionId) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

      const balances = await computeAccountBalances(session.institutionId);
      const source = balances.find((b) => b.id === refundAccountId);
      if (!source || source.balance < refundAmount) {
        return NextResponse.json({ error: `Yetersiz bakiye: seçilen hesapta ${(source?.balance ?? 0).toFixed(2)} ₺ var.` }, { status: 400 });
      }
    }

    const cancelledAmount = Math.round(open.reduce((s, i) => s + (Number(i.amount) - i.payments.reduce((x, p) => x + Number(p.amount), 0)), 0) * 100) / 100;

    const cancellation = await prisma.$transaction(async (tx) => {
      if (open.length > 0) {
        await tx.installment.updateMany({ where: { id: { in: open.map((i) => i.id) } }, data: { status: "CANCELLED" } });
      }
      return tx.enrollmentCancellation.create({
        data: {
          institutionId: session.institutionId,
          studentId,
          reason,
          cancelledInstallmentCount: open.length,
          cancelledAmount,
          totalPaid,
          refundAmount,
          refundAccountId: refundAmount > 0 ? refundAccountId : null,
          refundedAt: refundAmount > 0 ? new Date() : null,
          createdByAdminId: session.sub,
        },
      });
    });

    await recordPaymentAudit({
      session,
      action: "ENROLLMENT_CANCELLED",
      targetType: "EnrollmentCancellation",
      targetId: cancellation.id,
      // İzin tutarı İADE'dir — kasadan gerçekten çıkan para budur.
      // İptal edilen borç ayrıca metadata'da durur.
      amount: refundAmount,
      summary: `${open.length} taksit iptal · ${reason}`,
      metadata: { studentId, cancelledAmount, refundAccountId, reason },
    });

    return NextResponse.json(
      { id: cancellation.id, cancelledCount: open.length, cancelledAmount, refundAmount },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("cancellation_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/cancellation", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/cancellation", handlePost);
