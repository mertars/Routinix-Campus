import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/payments/parent?studentId= — SALT OKUNUR: o öğrencinin taksit
// planı + ödeme geçmişi. assertParentOwnsStudent, velinin SADECE kendi
// bağlı öğrencisini sorgulayabilmesini garanti eder (bkz. announcements
// route'undaki AYNI sahiplik deseni).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    await assertParentOwnsStudent(session.sub, studentId);

    const [installments, payments] = await Promise.all([
      prisma.installment.findMany({
        where: { studentId },
        include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.payment.findMany({
        where: { studentId, status: "COMPLETED" },
        orderBy: { paidAt: "desc" },
        include: { account: { select: { name: true } } },
      }),
    ]);

    const now = new Date();
    return NextResponse.json({
      installments: installments.map((i) => {
        const paidAmount = i.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: i.id,
          title: i.title,
          amount: Number(i.amount),
          remainingAmount: Number(i.amount) - paidAmount,
          dueDate: i.dueDate.toISOString(),
          status: i.status,
          isOverdue: i.status !== "PAID" && i.status !== "CANCELLED" && i.dueDate < now,
        };
      }),
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        accountName: p.account.name,
        paidAt: p.paidAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("parent_payments_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/parent", handleGet);
