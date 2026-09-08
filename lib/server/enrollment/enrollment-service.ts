import { prisma } from "@/lib/server/prisma";
import { createInstallmentPlan } from "@/lib/server/payments/plan-service";
import { academicYearOf, currentAcademicYear } from "@/lib/payments/academic-year";

// Kayıt süresi bitmeden kaç gün önce "yenileme" listesinde görünsün.
// 60 gün: veliyle konuşup fiyat belirlemeye ve sözleşme yenilemeye
// yetecek kadar erken, listeyi aylarca dolu tutmayacak kadar geç.
export const RENEWAL_WINDOW_DAYS = 60;

export class EnrollmentError extends Error {}

// Bir eğitim yılının varsayılan bitişi: o yılın Haziran sonu.
// "2026-2027" → 30.06.2027. Müdür isterse ezer.
export function defaultEndDate(academicYear: string): Date {
  const endYear = Number(academicYear.split("-")[1]);
  // ⚠️ UTC ile kurulur. new Date(y, 5, 30) YEREL gece yarısını üretir;
  // UTC+3'te bu UTC'de bir önceki güne düşer ve ISO olarak gösterilen
  // tarih "29 Haziran" görünür. Tarihi gün ortasına (UTC 12:00)
  // sabitlemek her iki yönde de kaymayı önler.
  return new Date(Date.UTC(endYear, 5, 30, 12, 0, 0));
}

export type CreateEnrollmentInput = {
  institutionId: string;
  studentId: string;
  academicYear: string;
  startDate: Date;
  endDate: Date;
  listAmount?: number | null;
  installmentCount?: number | null;
  note?: string | null;
  createdByAdminId: string;
};

export async function createEnrollment(input: CreateEnrollmentInput) {
  if (input.endDate <= input.startDate) {
    throw new EnrollmentError("Kayıt bitiş tarihi, başlangıçtan sonra olmalı.");
  }
  const existing = await prisma.studentEnrollment.findUnique({
    where: { studentId_academicYear: { studentId: input.studentId, academicYear: input.academicYear } },
    select: { id: true },
  });
  if (existing) {
    throw new EnrollmentError(`Bu öğrencinin ${input.academicYear} dönemi için zaten bir kaydı var.`);
  }

  return prisma.studentEnrollment.create({
    data: {
      institutionId: input.institutionId,
      studentId: input.studentId,
      academicYear: input.academicYear,
      startDate: input.startDate,
      endDate: input.endDate,
      listAmount: input.listAmount ?? null,
      installmentCount: input.installmentCount ?? null,
      note: input.note ?? null,
      createdByAdminId: input.createdByAdminId,
    },
  });
}

export type RenewalCandidate = {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  branchName: string;
  academicYear: string;
  endDate: string;
  daysLeft: number;
  listAmount: number | null;
  installmentCount: number | null;
  /** Bu öğrencinin kapanmamış borcu — yenilemeden önce görülmeli. */
  openDebt: number;
};

// Süresi dolan / dolmak üzere olan kayıtlar.
//
// Sadece "bitiş tarihi yaklaştı" demek yetmez: müdürün yenileme
// konuşmasına girmeden önce öğrencinin GEÇEN YILDAN kalan borcunu
// bilmesi gerekir. Bu yüzden açık borç da hesaplanıp veriliyor.
export async function listRenewalCandidates(institutionId: string, windowDays = RENEWAL_WINDOW_DAYS) {
  const now = new Date();
  const until = new Date(now.getTime() + windowDays * 86_400_000);

  const rows = await prisma.studentEnrollment.findMany({
    where: {
      institutionId,
      status: "ACTIVE",
      endDate: { lte: until },
      // Ayrılmış öğrenci yenileme listesinde çıkmaz.
      student: { isActive: true },
    },
    include: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          studentNumber: true,
          branch: { select: { name: true } },
          installments: {
            where: { status: { in: ["PENDING", "PARTIALLY_PAID"] } },
            select: { amount: true, payments: { where: { status: "COMPLETED" }, select: { amount: true } } },
          },
        },
      },
    },
    orderBy: { endDate: "asc" },
  });

  return rows.map((e): RenewalCandidate => {
    const openDebt =
      Math.round(
        e.student.installments.reduce(
          (sum, i) => sum + (Number(i.amount) - i.payments.reduce((s, p) => s + Number(p.amount), 0)),
          0
        ) * 100
      ) / 100;
    const daysLeft = Math.round(
      (new Date(e.endDate.getFullYear(), e.endDate.getMonth(), e.endDate.getDate()).getTime() -
        new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
        86_400_000
    );
    return {
      enrollmentId: e.id,
      studentId: e.student.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      studentNumber: e.student.studentNumber,
      branchName: e.student.branch.name,
      academicYear: e.academicYear,
      endDate: e.endDate.toISOString(),
      daysLeft,
      listAmount: e.listAmount != null ? Number(e.listAmount) : null,
      installmentCount: e.installmentCount,
      openDebt,
    };
  });
}

export type RenewInput = {
  institutionId: string;
  enrollmentId: string;
  /** Yeni dönemin ücreti — boşsa taksit planı KURULMAZ, sadece kayıt açılır. */
  listAmount?: number | null;
  installmentCount?: number | null;
  startDate: Date;
  endDate: Date;
  note?: string | null;
  createdByAdminId: string;
};

// Kaydı bir SONRAKİ döneme yeniler.
//
// ⚠️ Eski kayıt SİLİNMEZ, RENEWED olarak durur ve zincirle yenisine
// bağlanır: "geçen yıl ne ödedi, kaç taksitti" sorusu her zaman
// cevaplanabilir. Öğrencinin numarası da (Student.studentNumber) hiç
// değişmez — veli için değişen tek şey yeni yılın taksitleridir.
export async function renewEnrollment(input: RenewInput) {
  const current = await prisma.studentEnrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, institutionId: true, studentId: true, academicYear: true, status: true },
  });
  if (!current || current.institutionId !== input.institutionId) throw new EnrollmentError("Kayıt bulunamadı.");
  if (current.status !== "ACTIVE") throw new EnrollmentError("Bu kayıt zaten kapatılmış veya yenilenmiş.");

  const nextYear = academicYearOf(input.startDate);
  if (nextYear === current.academicYear) {
    throw new EnrollmentError(
      `Yeni dönem, mevcut dönemle aynı (${nextYear}). Başlangıç tarihini bir sonraki eğitim yılına alın.`
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.studentEnrollment.create({
      data: {
        institutionId: input.institutionId,
        studentId: current.studentId,
        academicYear: nextYear,
        startDate: input.startDate,
        endDate: input.endDate,
        listAmount: input.listAmount ?? null,
        installmentCount: input.installmentCount ?? null,
        note: input.note ?? null,
        createdByAdminId: input.createdByAdminId,
      },
    });
    await tx.studentEnrollment.update({
      where: { id: current.id },
      data: { status: "RENEWED", renewedToId: next.id },
    });
    return next;
  });

  // Taksit planı işlemin DIŞINDA kurulur: plan üretimi indirim
  // uygulaması ve satır satır yazma içerir, tek transaction'a sıkıştırmak
  // zaman aşımı riski doğurur (aynı hata deneme netlerinde yaşandı).
  let plan = null;
  if (input.listAmount && input.listAmount > 0 && input.installmentCount && input.installmentCount > 0) {
    plan = await createInstallmentPlan({
      institutionId: input.institutionId,
      studentId: current.studentId,
      listAmount: input.listAmount,
      installmentCount: input.installmentCount,
      startDate: input.startDate,
      titlePrefix: `${nextYear} Eğitim Ücreti`,
      academicYear: nextYear,
    });
  }

  return { enrollment: created, plan, previousYear: current.academicYear };
}

// Yenilenmeyen kayıt kapatılır. Öğrenciyi PASİFLEŞTİRMEZ — bu iki ayrı
// karar: "gelecek yıl gelmiyor" ile "artık öğrencimiz değil" aynı şey
// değildir ve borcu olan biri pasifleştirilirse takibi zorlaşır.
export async function closeEnrollment(institutionId: string, enrollmentId: string, left: boolean) {
  const current = await prisma.studentEnrollment.findUnique({
    where: { id: enrollmentId },
    select: { institutionId: true, status: true },
  });
  if (!current || current.institutionId !== institutionId) throw new EnrollmentError("Kayıt bulunamadı.");
  if (current.status !== "ACTIVE") throw new EnrollmentError("Bu kayıt zaten kapatılmış.");

  return prisma.studentEnrollment.update({
    where: { id: enrollmentId },
    data: { status: left ? "LEFT" : "ENDED" },
  });
}

export { currentAcademicYear };
