import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET ?studentId= — bir öğrencinin tahsilat geçmişi. "Bu öğrenci ne zaman
// ne ödedi" sorusunun cevabı; her satırdan makbuz basılabilir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });

    const payments = await prisma.payment.findMany({
      where: { institutionId: session.institutionId, studentId },
      include: {
        installment: { select: { title: true } },
        account: { select: { name: true } },
        recordedByAdmin: { select: { firstName: true, lastName: true } },
        voidedByAdmin: { select: { firstName: true, lastName: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        receiptNo: p.receiptNo,
        title: p.installment?.title ?? "Serbest tahsilat",
        accountName: p.account.name,
        collectedBy: `${p.recordedByAdmin.firstName} ${p.recordedByAdmin.lastName}`,
        paidAt: p.paidAt.toISOString(),
        note: p.note,
        voidedAt: p.voidedAt?.toISOString() ?? null,
        voidReason: p.voidReason,
        voidedBy: p.voidedByAdmin ? `${p.voidedByAdmin.firstName} ${p.voidedByAdmin.lastName}` : null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("student_payments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/payments", handleGet);
