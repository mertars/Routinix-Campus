import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, assertParentOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET /api/payments/parent?studentId= — SALT OKUNUR: o öğrencinin taksit
// planı, ödeme geçmişi (makbuzlarıyla), sıradaki taksit ve sözleşmeleri.
// assertParentOwnsStudent, velinin SADECE kendi bağlı öğrencisini
// sorgulayabilmesini garanti eder (bkz. announcements route'undaki AYNI
// sahiplik deseni).
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "parent");

    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });
    await assertParentOwnsStudent(session.sub, studentId);

    const [installments, payments, contracts] = await Promise.all([
      prisma.installment.findMany({
        where: { studentId },
        include: { payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
        orderBy: { dueDate: "asc" },
      }),
      prisma.payment.findMany({
        where: { studentId, status: "COMPLETED" },
        orderBy: { paidAt: "desc" },
        include: { account: { select: { name: true } }, installment: { select: { title: true } } },
      }),
      // Veli, imzaladığı sözleşmeye SMS'teki bağlantıyı kaybetse de
      // ulaşabilmeli — bu yüzden token'ı burada da veriyoruz. Token zaten
      // veliye gönderilmiş bir sırdır, kendi çocuğunun sözleşmesi için
      // geri okunması yeni bir bilgi açığa çıkarmaz.
      prisma.studentContract.findMany({
        where: { studentId, status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true, signedAt: true, expiresAt: true, shareToken: true },
      }),
    ]);

    const now = new Date();
    const active = installments.filter((i) => i.status !== "CANCELLED");
    const paidByInstallment = new Map(
      active.map((i) => [i.id, i.payments.reduce((sum, p) => sum + Number(p.amount), 0)])
    );

    const planTotal = active.reduce((sum, i) => sum + Number(i.amount), 0);
    const totalPaid = active.reduce((sum, i) => sum + (paidByInstallment.get(i.id) ?? 0), 0);

    // Sıradaki taksit: ödenmemiş taksitlerin vadesi EN YAKIN olanı. Vadesi
    // geçmiş bir taksit varsa sıradaki odur — veli önce onu görmelidir.
    const openSorted = active.filter((i) => i.status !== "PAID");
    const next = openSorted[0] ?? null;

    return NextResponse.json({
      summary: {
        planTotal: Math.round(planTotal * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        remaining: Math.round((planTotal - totalPaid) * 100) / 100,
      },
      nextInstallment: next
        ? {
            id: next.id,
            title: next.title,
            remainingAmount: Math.round((Number(next.amount) - (paidByInstallment.get(next.id) ?? 0)) * 100) / 100,
            dueDate: next.dueDate.toISOString(),
            // Kalan gün: negatifse vadesi geçmiş demektir. Gün farkını
            // saat/dakika kirliliğinden arındırmak için iki tarihi de
            // yerel gün başlangıcına çekiyoruz.
            daysLeft: Math.round(
              (new Date(next.dueDate.getFullYear(), next.dueDate.getMonth(), next.dueDate.getDate()).getTime() -
                new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
                86_400_000
            ),
          }
        : null,
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
        installmentTitle: p.installment?.title ?? null,
        paidAt: p.paidAt.toISOString(),
      })),
      contracts: contracts.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        signedAt: c.signedAt?.toISOString() ?? null,
        // İmzalanmamış ve süresi dolmuş sözleşme artık açılamaz; velinin
        // boşa tıklamaması için bunu peşinen bildiriyoruz.
        isExpired: c.status !== "SIGNED" && c.expiresAt < now,
        shareToken: c.shareToken,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("parent_payments_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/parent", handleGet);
