import { NextRequest, NextResponse } from "next/server";
import type { AdminAuthorityLevel } from "@prisma/client";
import { AdminCreateError, createStudentAccount, createTeacherAccount, createAdminAccount } from "@/lib/server/admin/create-user";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { recordPaymentAudit } from "@/lib/server/payments/payment-audit";
import {
  SetupValidationError,
  validateStudentPayment,
  applyStudentPayment,
  validateSalary,
  applySalary,
} from "@/lib/server/payments/enrollment-setup";

type CreateBody = {
  role?: "STUDENT" | "TEACHER" | "ADMIN";
  fullName?: string;
  nationalId?: string;
  // öğrenci
  branchId?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  healthNote?: string;
  // öğretmen
  subject?: string;
  advisorBranchId?: string;
  // öğretmen + yönetici ortak
  mobilePhone?: string;
  email?: string;
  // yönetici
  title?: string;
  authorityLevel?: AdminAuthorityLevel;
  // Kayıt sırasında ödeme kurulumu — ödeme panelindeki ekranlarla AYNI
  // servisleri kullanır (bkz. enrollment-setup).
  payment?: { listAmount?: unknown; installmentCount?: unknown; startDate?: unknown; titlePrefix?: unknown; academicYear?: unknown };
  salary?: { payType?: unknown; monthlyAmount?: unknown; hourlyRate?: unknown };
};

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = (await request.json()) as CreateBody;
    const { role, fullName } = body;

    if (!role || !fullName?.trim()) {
      return NextResponse.json({ error: "role ve fullName zorunludur." }, { status: 400 });
    }

    // Ödeme/maaş bilgisi KULLANICI OLUŞTURULMADAN ÖNCE doğrulanır:
    // hatalı bir ücret yüzünden hesap açılıp planı kurulmadan kalırsa,
    // müdür "kaydettim" sanır ve borç hiç yazılmaz.
    let paymentSetup = null;
    let salarySetup = null;
    try {
      if (role === "STUDENT") paymentSetup = validateStudentPayment(body.payment);
      else salarySetup = validateSalary(body.salary, role);
    } catch (setupError) {
      if (setupError instanceof SetupValidationError) {
        return NextResponse.json({ error: setupError.message }, { status: 400 });
      }
      throw setupError;
    }

    // Borç yazmak ve maaş tanımlamak PARA İŞLEMİDİR: ödeme modülünde
    // tam yetki gerektiren bu işlemler, kullanıcı ekleme ekranından
    // arka kapıdan yapılamamalı.
    if (paymentSetup || salarySetup) await requirePaymentRole(session, "FULL");

    if (role === "STUDENT") {
      const account = await createStudentAccount({
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName,
        nationalId: body.nationalId ?? "",
        branchId: body.branchId ?? "",
        phone: body.phone ?? "",
        parentName: body.parentName ?? "",
        parentPhone: body.parentPhone ?? "",
        healthNote: body.healthNote,
      });
      // Plan kurulumu hesabı oluşturduktan SONRA yapılır; buraya kadar
      // gelen bir hata artık doğrulama hatası olamaz (yukarıda geçti),
      // ama yine de sessizce yutulmaz — müdüre açıkça bildirilir.
      let plan = null;
      let paymentWarning: string | null = null;
      if (paymentSetup) {
        try {
          plan = await applyStudentPayment(session.institutionId, account.id, paymentSetup);
          await recordPaymentAudit({
            session,
            action: "INSTALLMENT_PLAN_CREATED",
            targetType: "Student",
            targetId: account.id,
            amount: plan.netAmount,
            summary: `${fullName.trim()} · kayıt sırasında ${plan.createdCount} taksit · liste ${paymentSetup.listAmount.toFixed(2)} ₺`,
            metadata: { installmentCount: plan.createdCount, listAmount: paymentSetup.listAmount, discountTotal: plan.discountTotal, viaEnrollment: true },
          });
        } catch (planError) {
          const message = planError instanceof Error ? planError.message : "Bilinmeyen hata";
          logger.error("enrollment_plan_failed", { studentId: account.id, error: message });
          paymentWarning = `Öğrenci oluşturuldu ancak taksit planı kurulamadı: ${message} Ödeme Takip > Öğrenci Ödemeleri'nden kurabilirsiniz.`;
        }
      }

      return NextResponse.json(
        { id: account.id, role: "STUDENT", username: account.username, password: account.password, plan, paymentWarning },
        { status: 201 }
      );
    }

    if (role === "TEACHER") {
      const account = await createTeacherAccount({
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName,
        nationalId: body.nationalId ?? "",
        subject: body.subject ?? "",
        mobilePhone: body.mobilePhone ?? "",
        email: body.email,
        advisorBranchId: body.advisorBranchId,
      });
      let salaryWarning: string | null = null;
      if (salarySetup) {
        try {
          await applySalary(session.institutionId, { teacherId: account.id }, salarySetup);
        } catch (salaryError) {
          const message = salaryError instanceof Error ? salaryError.message : "Bilinmeyen hata";
          logger.error("enrollment_salary_failed", { teacherId: account.id, error: message });
          salaryWarning = `Öğretmen oluşturuldu ancak ücret profili kaydedilemedi: ${message} Ödeme Takip > Bordro'dan tanımlayabilirsiniz.`;
        }
      }

      return NextResponse.json(
        {
          id: account.id,
          role: "TEACHER",
          username: account.username,
          password: account.password,
          institutionalCode: account.institutionalCode,
          salary: salarySetup,
          paymentWarning: salaryWarning,
        },
        { status: 201 }
      );
    }

    if (role === "ADMIN") {
      const account = await createAdminAccount({
        institutionId: session.institutionId,
        actorId: session.sub,
        fullName,
        title: body.title ?? "",
        mobilePhone: body.mobilePhone ?? "",
        email: body.email ?? "",
        authorityLevel: body.authorityLevel,
      });
      let adminSalaryWarning: string | null = null;
      if (salarySetup) {
        try {
          await applySalary(session.institutionId, { adminId: account.id }, salarySetup);
        } catch (salaryError) {
          const message = salaryError instanceof Error ? salaryError.message : "Bilinmeyen hata";
          logger.error("enrollment_salary_failed", { adminId: account.id, error: message });
          adminSalaryWarning = `Yönetici oluşturuldu ancak ücret profili kaydedilemedi: ${message} Ödeme Takip > Bordro'dan tanımlayabilirsiniz.`;
        }
      }

      return NextResponse.json(
        { id: account.id, role: "ADMIN", username: account.username, password: account.password, salary: salarySetup, paymentWarning: adminSalaryWarning },
        { status: 201 }
      );
    }

    return NextResponse.json({ error: "Geçersiz role değeri." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    if (error instanceof AdminCreateError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("admin_user_create_failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/users/create", handlePost);
