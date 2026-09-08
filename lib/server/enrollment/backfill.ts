import { prisma } from "@/lib/server/prisma";
import { academicYearOf, currentAcademicYear } from "@/lib/payments/academic-year";
import { defaultEndDate } from "@/lib/server/enrollment/enrollment-service";

// Kayıt dönemi (StudentEnrollment) özelliği sonradan eklendi. Ondan
// ÖNCE kaydedilmiş öğrencilerin hiçbir kayıt dönemi yok — bu, özelliği
// mevcut veri için fiilen ölü bırakıyordu:
//
//   • yenileme listesi boş kalıyor (kimsenin bitiş tarihi yok),
//   • toplu kayıt yenileme "Açık bir kayıt dönemi yok" diyor,
//   • "gelecek yıl devam edecek mi" sorusu hiç sorulmuyor.
//
// Ölçüldü: 369 aktif öğrencinin 367'sinde kayıt dönemi yoktu.
//
// Bu yüzden geriye dönük doldurma var. Uydurma yapmaz: dönem ücretini
// öğrencinin ZATEN VAR OLAN taksitlerinden okur, yoksa boş bırakır
// (müdür yenilerken girer).

export type BackfillResult = {
  academicYear: string;
  scanned: number;
  created: number;
  skipped: number;
};

// Bir öğrencinin bu döneme ait taksitlerinden dönem ücretini çıkarır.
// Taksitin üstünde yıl alanı yok; yıl, VADE TARİHİNDEN türetilir —
// başlık metnini ayrıştırmaktan daha sağlamdır.
function summarizePlan(
  installments: { amount: unknown; dueDate: Date }[],
  academicYear: string
): { listAmount: number | null; installmentCount: number | null } {
  const mine = installments.filter((i) => academicYearOf(i.dueDate) === academicYear);
  if (mine.length === 0) return { listAmount: null, installmentCount: null };
  const total = mine.reduce((sum, i) => sum + Number(i.amount), 0);
  return { listAmount: Math.round(total * 100) / 100, installmentCount: mine.length };
}

// Eğitim yılının başlangıcı: 1 Eylül. Öğrenci yıl ortasında kaydolduysa
// KENDİ kayıt tarihi kullanılır — "1 Eylül'de kaydoldu" demek yanlış olur.
function startOfAcademicYear(academicYear: string): Date {
  return new Date(Date.UTC(Number(academicYear.split("-")[0]), 8, 1, 12, 0, 0));
}

export async function backfillEnrollments(
  institutionId: string,
  actorId: string,
  academicYear = currentAcademicYear()
): Promise<BackfillResult> {
  const students = await prisma.student.findMany({
    where: {
      institutionId,
      isActive: true,
      // Zaten kayıt dönemi olan öğrenciye DOKUNULMAZ.
      enrollments: { none: {} },
    },
    select: {
      id: true,
      createdAt: true,
      installments: { select: { amount: true, dueDate: true } },
    },
  });

  if (students.length === 0) return { academicYear, scanned: 0, created: 0, skipped: 0 };

  const yearStart = startOfAcademicYear(academicYear);
  const endDate = defaultEndDate(academicYear);

  const rows = students.map((s) => {
    const { listAmount, installmentCount } = summarizePlan(s.installments, academicYear);
    return {
      institutionId,
      studentId: s.id,
      academicYear,
      // Yıl başından önce kaydolmuş (eski) öğrenciler için dönem başı,
      // yıl içinde kaydolanlar için gerçek kayıt tarihi.
      startDate: s.createdAt > yearStart ? s.createdAt : yearStart,
      endDate,
      listAmount,
      installmentCount,
      note: "Kayıt dönemi özelliği eklenmeden önce kaydolan öğrenci için otomatik oluşturuldu.",
      createdByAdminId: actorId,
    };
  });

  // skipDuplicates: bu iş iki kez çalıştırılırsa (müdür butona iki kez
  // basarsa) ikinci çalıştırma sessizce hiçbir şey yapmaz — @@unique
  // [studentId, academicYear] zaten korur, hata fırlatmasına gerek yok.
  const result = await prisma.studentEnrollment.createMany({ data: rows, skipDuplicates: true });

  return {
    academicYear,
    scanned: students.length,
    created: result.count,
    skipped: students.length - result.count,
  };
}

// Doldurmanın gerekip gerekmediğini söyler — panelde uyarı göstermek için.
export async function countStudentsWithoutEnrollment(institutionId: string): Promise<number> {
  return prisma.student.count({
    where: { institutionId, isActive: true, enrollments: { none: {} } },
  });
}
