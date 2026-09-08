import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import {
  EnrollmentError,
  renewEnrollment,
  closeEnrollment,
  defaultEndDate,
} from "@/lib/server/enrollment/enrollment-service";
import { academicYearOf } from "@/lib/payments/academic-year";

export const dynamic = "force-dynamic";

// POST /api/enrollments/[id]/renew — { startDate, endDate?, listAmount?, installmentCount?, note? }
//
// Kaydı bir sonraki döneme yeniler. Eski kayıt SİLİNMEZ; RENEWED olarak
// durur ve zincirle yenisine bağlanır. Öğrenci numarası değişmez.
//
// Ücret verilirse taksit planı da kurulur — bu BORÇ YAZMAKTIR, dolayısıyla
// ödeme modülünde tam yetki ister.
async function handlePost(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const startDate = body?.startDate ? new Date(body.startDate) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) {
      return NextResponse.json({ error: "Yeni dönem başlangıcı zorunludur." }, { status: 400 });
    }
    const listAmount = body?.listAmount != null ? Number(body.listAmount) : null;
    const installmentCount = body?.installmentCount != null ? Number(body.installmentCount) : null;

    if (listAmount != null && (!Number.isFinite(listAmount) || listAmount <= 0)) {
      return NextResponse.json({ error: "Ücret pozitif bir sayı olmalı." }, { status: 400 });
    }
    if (listAmount != null && (!Number.isInteger(installmentCount) || (installmentCount ?? 0) < 1)) {
      return NextResponse.json({ error: "Ücret girildiyse taksit sayısı da gereklidir." }, { status: 400 });
    }
    // Borç yazmak para işlemidir; yenileme ekranından arka kapıdan
    // yapılamaz (bkz. users/create'teki aynı kural).
    if (listAmount != null) await requirePaymentRole(session, "FULL");

    const endDate = body?.endDate ? new Date(body.endDate) : defaultEndDate(academicYearOf(startDate));
    if (Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: "Bitiş tarihi geçerli olmalı." }, { status: 400 });
    }

    const result = await renewEnrollment({
      institutionId: session.institutionId,
      enrollmentId: params.id,
      listAmount,
      installmentCount,
      startDate,
      endDate,
      note: (body?.note as string | undefined)?.trim() || null,
      createdByAdminId: session.sub,
    });

    if (result.plan) {
      await recordPaymentAudit({
        session,
        action: "INSTALLMENT_PLAN_CREATED",
        targetType: "Student",
        targetId: result.enrollment.studentId,
        amount: result.plan.netAmount,
        summary: `${result.previousYear} → ${result.enrollment.academicYear} yenileme · ${result.plan.createdCount} taksit`,
        metadata: {
          installmentCount: result.plan.createdCount,
          listAmount,
          discountTotal: result.plan.discountTotal,
          viaRenewal: true,
        },
      });
    }

    return NextResponse.json(
      {
        enrollmentId: result.enrollment.id,
        academicYear: result.enrollment.academicYear,
        previousYear: result.previousYear,
        plan: result.plan,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof EnrollmentError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("enrollment_renew_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// DELETE — kaydı yenilemeden kapatır. { left: true } ise "ayrıldı".
// Öğrenciyi PASİFLEŞTİRMEZ: "gelecek yıl gelmiyor" ile "artık
// öğrencimiz değil" ayrı kararlar.
async function handleDelete(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    const left = request.nextUrl.searchParams.get("left") === "true";
    await closeEnrollment(session.institutionId, params.id, left);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof EnrollmentError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("enrollment_close_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/enrollments/[id]/renew", handlePost);
export const DELETE = withApiLogging("DELETE /api/enrollments/[id]/renew", handleDelete);
