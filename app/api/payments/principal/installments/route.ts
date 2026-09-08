import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { currentAcademicYear } from "@/lib/payments/academic-year";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import { createInstallmentPlan } from "@/lib/server/payments/plan-service";
import { apiFailure } from "@/lib/server/api-failure";

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
    return apiFailure("installments_list_failed", error);
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
      const academicYear = (body.academicYear as string | undefined)?.trim() || currentAcademicYear();
      if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
        return NextResponse.json({ error: "installmentCount 1-36 arası bir tam sayı olmalı." }, { status: 400 });
      }
      if (!Number.isFinite(listAmount) || listAmount <= 0) {
        return NextResponse.json({ error: "totalAmount pozitif bir sayı olmalı." }, { status: 400 });
      }

      // İndirim uygulaması, kuruş bölüşümü ve indirim anlık kaydı
      // plan-service içinde; toplu atama ucu AYNI yolu kullanır.
      let result;
      try {
        result = await createInstallmentPlan({
          institutionId: session.institutionId,
          studentId,
          listAmount,
          installmentCount,
          startDate,
          titlePrefix,
          academicYear,
        });
      } catch (planError) {
        return NextResponse.json({ error: planError instanceof Error ? planError.message : "Plan oluşturulamadı." }, { status: 400 });
      }

      await recordPaymentAudit({
        session,
        action: "INSTALLMENT_PLAN_CREATED",
        targetType: "Student",
        targetId: studentId,
        amount: result.netAmount,
        summary: `${result.createdCount} taksit · liste ${listAmount.toFixed(2)} ₺${result.discountTotal > 0 ? ` · indirim ${result.discountTotal.toFixed(2)} ₺` : ""}`,
        metadata: { installmentCount: result.createdCount, listAmount, discountTotal: result.discountTotal },
      });

      return NextResponse.json(result, { status: 201 });
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
    return apiFailure("installment_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/installments", handleGet);
export const POST = withApiLogging("POST /api/payments/principal/installments", handlePost);
