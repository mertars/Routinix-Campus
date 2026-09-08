import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { applyDiscounts, getActiveDiscounts } from "@/lib/server/payments/discount-service";
import { splitIntoInstallments } from "@/lib/server/payments/installment-math";

export const dynamic = "force-dynamic";

// GET /api/payments/principal/installments?studentId=&status=
// studentId verilmezse kurumun TÜM taksitleri (Kontrol Paneli/gecikmiş
// liste için) döner; studentId verilirse o öğrencinin taksit planı.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const studentId = request.nextUrl.searchParams.get("studentId");
    const status = request.nextUrl.searchParams.get("status");

    const installments = await prisma.installment.findMany({
      where: {
        institutionId: session.institutionId,
        ...(studentId ? { studentId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        student: { select: { firstName: true, lastName: true, branch: { select: { name: true, grade: true } } } },
        payments: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    const now = new Date();
    return NextResponse.json({
      installments: installments.map((i) => {
        const paidAmount = i.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        return {
          id: i.id,
          studentId: i.studentId,
          studentName: `${i.student.firstName} ${i.student.lastName}`,
          branchName: i.student.branch.name,
          grade: i.student.branch.grade,
          title: i.title,
          amount: Number(i.amount),
          paidAmount,
          remainingAmount: Number(i.amount) - paidAmount,
          dueDate: i.dueDate.toISOString(),
          status: i.status,
          isOverdue: i.status !== "PAID" && i.status !== "CANCELLED" && i.dueDate < now,
        };
      }),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("installments_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/payments/principal/installments
// Tekil: { studentId, title, amount, dueDate }
// Toplu plan: { studentId, totalAmount, installmentCount, startDate, titlePrefix? }
//   -> installmentCount adet, totalAmount/installmentCount tutarında, birer ay
//   arayla (startDate'ten itibaren) taksit oluşturur.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "FULL");

    const body = await request.json().catch(() => null);
    const studentId = body?.studentId as string | undefined;
    if (!studentId) return NextResponse.json({ error: "studentId zorunludur." }, { status: 400 });

    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { institutionId: true } });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    if (student.institutionId !== session.institutionId) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });

    if (body?.installmentCount) {
      const installmentCount = Number(body.installmentCount);
      const listAmount = Number(body.totalAmount);
      const startDate = body.startDate ? new Date(body.startDate) : new Date();
      const titlePrefix = (body.titlePrefix as string | undefined)?.trim() || "Eğitim Ücreti";
      const academicYear = (body.academicYear as string | undefined)?.trim() || "2025-2026";
      if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
        return NextResponse.json({ error: "installmentCount 1-36 arası bir tam sayı olmalı." }, { status: 400 });
      }
      if (!Number.isFinite(listAmount) || listAmount <= 0) {
        return NextResponse.json({ error: "totalAmount pozitif bir sayı olmalı." }, { status: 400 });
      }

      // Gelen tutar LİSTE FİYATIDIR — öğrencinin aktif indirimleri burada
      // uygulanır ve taksitler NET tutardan üretilir. Uygulanan liste/
      // indirim tutarları indirim kaydına basılır (snapshot) ki "ne kadar
      // burs dağıttık" raporu geriye dönük değişmesin.
      const activeDiscounts = await getActiveDiscounts(session.institutionId, studentId, academicYear);
      const calc = applyDiscounts(listAmount, activeDiscounts);
      const totalAmount = calc.netAmount;
      if (totalAmount <= 0) {
        return NextResponse.json({ error: "İndirimler sonrası net tutar sıfır — taksit planı oluşturulamaz." }, { status: 400 });
      }
      // Kuruş küsuratı kaybolmasın diye ortak yardımcı (bkz. installment-math).
      const amounts = splitIntoInstallments(totalAmount, installmentCount);
      const rows = amounts.map((amount, i) => {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        return {
          institutionId: session.institutionId,
          studentId,
          title: `${titlePrefix} - Taksit ${i + 1}/${installmentCount}`,
          amount,
          dueDate,
        };
      });
      await prisma.installment.createMany({ data: rows });

      // İndirim anlık kaydı — plan üretildiği AN'daki liste/indirim
      // tutarları indirim satırlarına yazılır (bkz. schema > StudentDiscount).
      if (calc.discountTotal > 0) {
        const now = new Date();
        for (const row of calc.rows) {
          await prisma.studentDiscount.update({
            where: { id: row.id },
            data: { appliedListAmount: listAmount, appliedDiscount: row.amount, appliedAt: now },
          });
        }
      }

      await recordPaymentAudit({
        session,
        action: "INSTALLMENT_PLAN_CREATED",
        targetType: "Student",
        targetId: studentId,
        amount: totalAmount,
        summary: `${rows.length} taksit · liste ${listAmount.toFixed(2)} ₺${calc.discountTotal > 0 ? ` · indirim ${calc.discountTotal.toFixed(2)} ₺` : ""}`,
        metadata: { installmentCount: rows.length, listAmount, discountTotal: calc.discountTotal },
      });

      return NextResponse.json(
        {
          createdCount: rows.length,
          listAmount,
          discountTotal: calc.discountTotal,
          netAmount: totalAmount,
          appliedDiscounts: calc.rows.map((r) => ({ label: r.label, amount: r.amount })),
        },
        { status: 201 }
      );
    }

    const title = (body?.title as string | undefined)?.trim();
    const amount = Number(body?.amount);
    const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
    if (!title) return NextResponse.json({ error: "title zorunludur." }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "amount pozitif bir sayı olmalı." }, { status: 400 });
    if (!dueDate || Number.isNaN(dueDate.getTime())) return NextResponse.json({ error: "dueDate geçerli bir tarih olmalı." }, { status: 400 });

    const installment = await prisma.installment.create({
      data: { institutionId: session.institutionId, studentId, title, amount, dueDate },
    });
    return NextResponse.json({ installment }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("installment_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const GET = withApiLogging("GET /api/payments/principal/installments", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/installments", handlePost);
