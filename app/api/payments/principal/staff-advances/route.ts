import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";

export const dynamic = "force-dynamic";

// GET — avanslar (mahsup edilmemişler önce).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const advances = await prisma.staffAdvance.findMany({
      where: { institutionId: session.institutionId },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
        admin: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ payrollItemId: "asc" }, { paidAt: "desc" }],
      take: 100,
    });

    return NextResponse.json({
      advances: advances.map((a) => {
        const person = a.teacher ?? a.admin;
        return {
          id: a.id,
          staffName: person ? `${person.firstName} ${person.lastName}` : "—",
          amount: Number(a.amount),
          paidAt: a.paidAt.toISOString(),
          note: a.note,
          isSettled: a.payrollItemId != null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("staff_advances_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { teacherId? | adminId?, amount, note? } — avans kaydı. Bir sonraki
// bordroda otomatik mahsup edilir (bkz. computePayrollDraft).
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const teacherId = (body?.teacherId as string | undefined) || null;
    const adminId = (body?.adminId as string | undefined) || null;
    const amount = Number(body?.amount);
    const note = (body?.note as string | undefined)?.trim() || null;

    if (!teacherId && !adminId) return NextResponse.json({ error: "teacherId veya adminId zorunludur." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif bir sayı olmalı." }, { status: 400 });

    if (teacherId) {
      const t = await prisma.teacher.findUnique({ where: { id: teacherId }, select: { institutionId: true } });
      if (!t || t.institutionId !== session.institutionId) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    } else {
      const a = await prisma.admin.findUnique({ where: { id: adminId! }, select: { institutionId: true } });
      if (!a || a.institutionId !== session.institutionId) return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 });
    }

    const advance = await prisma.staffAdvance.create({
      data: { institutionId: session.institutionId, teacherId, adminId, amount, note },
    });
    return NextResponse.json({ advance: { id: advance.id } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("staff_advance_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/staff-advances", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/staff-advances", handlePost);
