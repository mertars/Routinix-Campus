import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { requirePaymentRole } from "@/lib/server/payments/require-payment-role";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// GET — ilk kurulum kontrol listesi.
//
// Panele ilk giren müdür dokuz sekme ve dört tane ₺0 ile karşılaşıyordu;
// nereden başlayacağına dair tek kelime yoktu. Bu uç, kurulumun hangi
// adımının eksik olduğunu söyler ve liste tamamlanınca ekrandan KAYBOLUR
// (kalıcı bir "yapılacaklar" kutusu, kurulmuş bir kurumda gürültüdür).
async function handleGet() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    await requirePaymentRole(session, "COLLECTOR");

    const institutionId = session.institutionId;
    const [accountCount, studentCount, installmentCount, recurringCount, salaryCount] = await Promise.all([
      prisma.paymentAccount.count({ where: { institutionId, isActive: true } }),
      prisma.student.count({ where: { institutionId, isActive: true } }),
      prisma.installment.count({ where: { institutionId, status: { not: "CANCELLED" } } }),
      prisma.recurringExpense.count({ where: { institutionId, isActive: true } }),
      prisma.staffSalaryProfile.count({ where: { institutionId, isActive: true } }),
    ]);

    // Sıra ÖNEMLİ: her adım bir öncekine dayanır. Öğrenci yokken taksit
    // planı kurulamaz, hesap yokken tahsilat alınamaz.
    const steps = [
      {
        key: "accounts",
        label: "Kasa ve banka hesabı ekleyin",
        hint: "Tahsilat ve ödemeler bir hesaba işlenir.",
        done: accountCount > 0,
        tab: "accounts",
      },
      {
        key: "students",
        label: "Öğrenci kaydı oluşturun",
        hint: "Öğrenciler Kampüs ERP > Kullanıcı Yönetimi'nden eklenir.",
        done: studentCount > 0,
        // Bu adım ödeme panelinde YAPILMAZ; sekme yerine dış yönlendirme.
        href: "/principal",
      },
      {
        key: "plans",
        label: "Taksit planlarını kurun",
        hint: "Şubenin tamamına tek seferde plan kurabilirsiniz.",
        done: installmentCount > 0,
        tab: "students",
      },
      {
        key: "recurring",
        label: "Tekrar eden giderleri tanımlayın",
        hint: "Kira ve faturaları bir kez yazın, her ay tek tıkla hazırlansın.",
        done: recurringCount > 0,
        tab: "expenses",
      },
      {
        key: "salaries",
        label: "Personel ücretlerini tanımlayın",
        hint: "Bordro bu profillerden hesaplanır.",
        done: salaryCount > 0,
        tab: "payroll",
      },
    ];

    return NextResponse.json({
      steps,
      completed: steps.filter((s) => s.done).length,
      total: steps.length,
      isComplete: steps.every((s) => s.done),
      counts: { accountCount, studentCount, installmentCount, recurringCount, salaryCount },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("setup_status_failed", error);
  }
}

export const GET = withApiLogging("GET /api/payments/principal/setup-status", handleGet);
