import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { computePayrollDraft } from "@/lib/server/payroll/payroll-service";

export const dynamic = "force-dynamic";

// GET — bordro dönemleri + (preview=1 ise) henüz kaydedilmemiş taslak hesap.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const wantPreview = request.nextUrl.searchParams.get("preview") === "1";

    const periods = await prisma.payrollPeriod.findMany({
      where: { institutionId: session.institutionId },
      include: { items: true },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 24,
    });

    const preview = wantPreview ? await computePayrollDraft(session.institutionId) : null;

    return NextResponse.json({
      periods: periods.map((p) => ({
        id: p.id,
        year: p.year,
        month: p.month,
        status: p.status,
        totalAmount: Number(p.totalAmount),
        paidAt: p.paidAt?.toISOString() ?? null,
        itemCount: p.items.length,
        items: p.items.map((i) => ({
          id: i.id,
          staffName: i.staffName,
          staffRole: i.staffRole,
          payType: i.payType,
          hours: i.hours ? Number(i.hours) : null,
          rate: i.rate ? Number(i.rate) : null,
          baseAmount: Number(i.baseAmount),
          advanceDeduction: Number(i.advanceDeduction),
          netAmount: Number(i.netAmount),
        })),
      })),
      preview: preview?.map((d) => ({
        staffName: d.staffName,
        staffRole: d.staffRole,
        payType: d.payType,
        hours: d.hours,
        rate: d.rate,
        baseAmount: d.baseAmount,
        advanceDeduction: d.advanceDeduction,
        netAmount: d.netAmount,
      })),
      previewTotal: preview?.reduce((s, d) => s + d.netAmount, 0) ?? null,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payroll_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST — { year, month } için bordro oluştur. Hesap computePayrollDraft ile
// yapılır (önizlemeyle AYNI kod yolu), sonuç PayrollItem satırları olarak
// dondurulur ve mahsup edilen avanslar o satıra bağlanır.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const now = new Date();
    const year = Number(body?.year ?? now.getFullYear());
    const month = Number(body?.month ?? now.getMonth() + 1);
    if (!Number.isInteger(year) || year < 2020 || year > 2100) return NextResponse.json({ error: "Geçersiz yıl." }, { status: 400 });
    if (!Number.isInteger(month) || month < 1 || month > 12) return NextResponse.json({ error: "Geçersiz ay." }, { status: 400 });

    const existing = await prisma.payrollPeriod.findUnique({
      where: { institutionId_year_month: { institutionId: session.institutionId, year, month } },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ error: "Bu dönem için zaten bordro var." }, { status: 409 });

    const drafts = await computePayrollDraft(session.institutionId);
    if (drafts.length === 0) {
      return NextResponse.json({ error: "Ücret profili tanımlı personel yok. Önce personel ücretlerini tanımlayın." }, { status: 400 });
    }

    const total = drafts.reduce((s, d) => s + d.netAmount, 0);

    const period = await prisma.$transaction(async (tx) => {
      const created = await tx.payrollPeriod.create({
        data: { institutionId: session.institutionId, year, month, totalAmount: total },
      });

      for (const d of drafts) {
        const item = await tx.payrollItem.create({
          data: {
            periodId: created.id,
            teacherId: d.teacherId,
            adminId: d.adminId,
            staffName: d.staffName,
            staffRole: d.staffRole,
            payType: d.payType,
            hours: d.hours,
            rate: d.rate,
            baseAmount: d.baseAmount,
            advanceDeduction: d.advanceDeduction,
            netAmount: d.netAmount,
          },
        });
        // Mahsup edilen avansları bu satıra bağla — böylece bir daha
        // düşülmezler (bkz. computePayrollDraft > payrollItemId: null filtresi).
        if (d.advanceDeduction > 0 && d.pendingAdvanceIds.length > 0) {
          await tx.staffAdvance.updateMany({ where: { id: { in: d.pendingAdvanceIds } }, data: { payrollItemId: item.id } });
        }
      }

      return created;
    });

    return NextResponse.json({ period: { id: period.id, year, month, totalAmount: total, itemCount: drafts.length } }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("payroll_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/payroll", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/payroll", handlePost);
