import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { assertSufficientFunds } from "@/lib/server/payments/assert-funds";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { PAYROLL_CATEGORY } from "@/lib/server/payroll/payroll-service";

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// POST /api/payments/principal/payroll/[id]/pay — { accountId }
// Bordroyu ödendi işaretler ve kasa/bankadan düşen TEK bir toplu Expense
// üretir. Böylece bakiye ve gider raporları bordroyu otomatik görür; ayrıca
// elle "Personel Maaşı" gideri girilmesi gerekmez (çift kayıt riski yok).
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const period = await prisma.payrollPeriod.findUnique({
      where: { id: params.id },
      select: { institutionId: true, status: true, year: true, month: true, totalAmount: true },
    });
    if (!period) return NextResponse.json({ error: "Bordro bulunamadı." }, { status: 404 });
    requireInstitution(session, period.institutionId);
    if (period.status === "PAID") return NextResponse.json({ error: "Bu bordro zaten ödenmiş." }, { status: 400 });

    const body = await request.json().catch(() => null);
    const accountId = body?.accountId as string | undefined;
    if (!accountId) return NextResponse.json({ error: "accountId zorunludur." }, { status: 400 });

    const account = await prisma.paymentAccount.findUnique({ where: { id: accountId }, select: { institutionId: true } });
    if (!account || account.institutionId !== session.institutionId) return NextResponse.json({ error: "Hesap bulunamadı." }, { status: 404 });

    // Bordro gideri her zaman "Personel Maaş" kategorisine yazılır; kurumda
    // yoksa oluşturulur (kategori silinmiş/yeni kurum olabilir).
    const category =
      (await prisma.expenseCategory.findFirst({ where: { institutionId: session.institutionId, name: PAYROLL_CATEGORY } })) ??
      (await prisma.expenseCategory.create({ data: { institutionId: session.institutionId, name: PAYROLL_CATEGORY } }));

    const funds = await assertSufficientFunds(session.institutionId, accountId, Number(period.totalAmount), body?.allowOverdraft === true);
    if (!funds.ok) return NextResponse.json({ error: funds.error, code: "INSUFFICIENT_FUNDS", balance: funds.balance }, { status: 400 });

    const label = `${MONTH_NAMES[period.month - 1]} ${period.year} Personel Bordrosu`;
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          institutionId: session.institutionId,
          categoryId: category.id,
          accountId,
          title: label,
          amount: period.totalAmount,
          status: "PAID",
          paidAt: now,
          recordedByAdminId: session.sub,
          note: "Bordro modülünden otomatik oluşturuldu.",
        },
      });
      return tx.payrollPeriod.update({
        where: { id: params.id },
        data: { status: "PAID", paidAt: now, expenseId: expense.id },
      });
    });

    await recordPaymentAudit({
      session,
      action: "PAYROLL_PAID",
      targetType: "PayrollPeriod",
      targetId: params.id,
      amount: Number(period.totalAmount),
      summary: label,
      metadata: { accountId, expenseId: updated.expenseId },
    });

    return NextResponse.json({ period: { id: updated.id, status: updated.status, expenseId: updated.expenseId } });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payroll_pay_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/payments/principal/payroll/[id]/pay", handlePost);
