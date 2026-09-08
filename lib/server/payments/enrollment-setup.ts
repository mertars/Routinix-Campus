import { prisma } from "@/lib/server/prisma";
import { createInstallmentPlan } from "@/lib/server/payments/plan-service";
import { currentAcademicYear } from "@/lib/payments/academic-year";

// Kayıt sırasında ödeme kurulumu.
//
// Müdür öğrenciyi eklerken ücretini de giriyor; öğretmeni eklerken
// maaşını. Bu, ödeme panelindeki ekranların YERİNE GEÇMEZ — aynı
// servisleri (plan-service, StaffSalaryProfile) çağırır. İki ayrı kod
// yolu olsaydı aynı öğrenci hangi ekrandan kaydedildiğine göre farklı
// borçlanabilirdi.
//
// ⚠️ Doğrulama, KULLANICI OLUŞTURULMADAN ÖNCE yapılır: hatalı bir ücret
// yüzünden öğrenci hesabı açılıp planı kurulmadan kalırsa, müdür
// "kaydettim" sanır ve borç hiç yazılmaz.

export class SetupValidationError extends Error {}

export type StudentPaymentInput = {
  listAmount?: unknown;
  installmentCount?: unknown;
  startDate?: unknown;
  titlePrefix?: unknown;
  academicYear?: unknown;
};

export type ValidatedStudentPayment = {
  listAmount: number;
  installmentCount: number;
  startDate: Date;
  titlePrefix: string;
  academicYear: string;
};

export function validateStudentPayment(input: StudentPaymentInput | null | undefined): ValidatedStudentPayment | null {
  if (!input) return null;
  const listAmount = Number(input.listAmount);
  const installmentCount = Number(input.installmentCount);

  // Tutar girilmemişse ödeme kurulumu İSTENMEMİŞ demektir — kullanıcı
  // yine de oluşturulur, planı sonra kurulur.
  if (!input.listAmount && input.listAmount !== 0) return null;

  if (!Number.isFinite(listAmount) || listAmount <= 0) {
    throw new SetupValidationError("Ücret pozitif bir sayı olmalı.");
  }
  if (!Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
    throw new SetupValidationError("Taksit sayısı 1 ile 36 arasında olmalı.");
  }
  const startDate = input.startDate ? new Date(String(input.startDate)) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    throw new SetupValidationError("İlk vade geçerli bir tarih olmalı.");
  }

  return {
    listAmount,
    installmentCount,
    startDate,
    titlePrefix: (typeof input.titlePrefix === "string" && input.titlePrefix.trim()) || "Eğitim Ücreti",
    academicYear: (typeof input.academicYear === "string" && input.academicYear.trim()) || currentAcademicYear(),
  };
}

export async function applyStudentPayment(
  institutionId: string,
  studentId: string,
  setup: ValidatedStudentPayment
) {
  return createInstallmentPlan({ institutionId, studentId, ...setup });
}

export type SalaryInput = { payType?: unknown; monthlyAmount?: unknown; hourlyRate?: unknown };
export type ValidatedSalary = { payType: "MONTHLY_SALARY" | "HOURLY"; monthlyAmount: number | null; hourlyRate: number | null };

// forRole: yönetici ders programında yer almaz, saatlik ücreti
// hesaplanamaz (bkz. salary-profiles route'undaki aynı kural).
export function validateSalary(input: SalaryInput | null | undefined, forRole: "TEACHER" | "ADMIN"): ValidatedSalary | null {
  if (!input || !input.payType) return null;
  const payType = input.payType;
  if (payType !== "MONTHLY_SALARY" && payType !== "HOURLY") {
    throw new SetupValidationError("Ücret tipi geçersiz.");
  }
  if (forRole === "ADMIN" && payType === "HOURLY") {
    throw new SetupValidationError("Yönetici için saatlik ücret desteklenmiyor.");
  }

  if (payType === "MONTHLY_SALARY") {
    const monthlyAmount = Number(input.monthlyAmount);
    if (!Number.isFinite(monthlyAmount) || monthlyAmount <= 0) {
      throw new SetupValidationError("Aylık ücret pozitif bir sayı olmalı.");
    }
    return { payType, monthlyAmount, hourlyRate: null };
  }

  const hourlyRate = Number(input.hourlyRate);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    throw new SetupValidationError("Saat ücreti pozitif bir sayı olmalı.");
  }
  return { payType, monthlyAmount: null, hourlyRate };
}

export async function applySalary(
  institutionId: string,
  target: { teacherId: string } | { adminId: string },
  salary: ValidatedSalary
) {
  const data = { institutionId, ...salary, isActive: true };
  return "teacherId" in target
    ? prisma.staffSalaryProfile.upsert({
        where: { teacherId: target.teacherId },
        create: { ...data, teacherId: target.teacherId },
        update: data,
      })
    : prisma.staffSalaryProfile.upsert({
        where: { adminId: target.adminId },
        create: { ...data, adminId: target.adminId },
        update: data,
      });
}
