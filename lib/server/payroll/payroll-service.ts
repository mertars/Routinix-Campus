import { prisma } from "@/lib/server/prisma";

// Bir ayda ortalama kaç hafta var — haftalık ders programından (LessonSlot)
// aylık ders saatini türetirken kullanılır. 52 hafta / 12 ay = 4.333...
// Bu bir TAHMİNDİR: tatiller, telafi dersleri ve 4/5 haftalık aylar sapma
// yaratır, bu yüzden hesaplanan saat bordroda DÜZENLENEBİLİR olarak sunulur
// (bkz. PayrollItem.hours).
export const AVERAGE_WEEKS_PER_MONTH = 4.33;

// Ödenen bordronun düştüğü gider kategorisi. Nakit akışı projeksiyonu bu
// kategoriyi geçmiş ortalamadan DEĞİL, bordro taslağından tahmin eder
// (ileriye dönük ve daha doğru) — bu yüzden ad tek yerde tanımlı olmalı.
export const PAYROLL_CATEGORY = "Personel Maaş";

export type StaffPayrollDraft = {
  teacherId: string | null;
  adminId: string | null;
  staffName: string;
  staffRole: "Öğretmen" | "Yönetici";
  payType: "MONTHLY_SALARY" | "HOURLY";
  hours: number | null;
  rate: number | null;
  baseAmount: number;
  advanceDeduction: number;
  netAmount: number;
  pendingAdvanceIds: string[];
};

// Bir dönem için bordro TASLAĞI hesaplar — DB'ye HİÇBİR ŞEY YAZMAZ.
// Böylece aynı hesap hem "önizleme" hem "oluştur" tarafından kullanılır ve
// kullanıcının gördüğü rakam ile kaydedilen rakam ayrışamaz.
export async function computePayrollDraft(institutionId: string): Promise<StaffPayrollDraft[]> {
  const profiles = await prisma.staffSalaryProfile.findMany({
    where: { institutionId, isActive: true },
    include: {
      teacher: { select: { id: true, firstName: true, lastName: true, isActive: true } },
      admin: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Saatlik personelin haftalık ders saati — LessonSlot satır sayısı
  // (her slot 1 ders saati kabul edilir, bkz. ScheduleSlotDefinition'daki
  // "16:00-17:00" gibi tek saatlik etiketler).
  const weeklySlotCounts = await prisma.lessonSlot.groupBy({
    by: ["teacherId"],
    where: { branch: { institutionId } },
    _count: { _all: true },
  });
  const weeklyByTeacher = new Map(weeklySlotCounts.map((r) => [r.teacherId, r._count._all]));

  // Henüz mahsup edilmemiş avanslar (payrollItemId null).
  const pendingAdvances = await prisma.staffAdvance.findMany({
    where: { institutionId, payrollItemId: null },
    select: { id: true, teacherId: true, adminId: true, amount: true },
  });

  const drafts: StaffPayrollDraft[] = [];

  for (const profile of profiles) {
    // Pasifleştirilmiş öğretmen bordroya girmez.
    if (profile.teacher && !profile.teacher.isActive) continue;

    const isTeacher = Boolean(profile.teacherId);
    const person = profile.teacher ?? profile.admin;
    if (!person) continue;

    let hours: number | null = null;
    let rate: number | null = null;
    let baseAmount = 0;

    if (profile.payType === "HOURLY") {
      const weekly = profile.teacherId ? (weeklyByTeacher.get(profile.teacherId) ?? 0) : 0;
      hours = Math.round(weekly * AVERAGE_WEEKS_PER_MONTH * 100) / 100;
      rate = Number(profile.hourlyRate ?? 0);
      baseAmount = Math.round(hours * rate * 100) / 100;
    } else {
      baseAmount = Number(profile.monthlyAmount ?? 0);
    }

    const own = pendingAdvances.filter((a) => (profile.teacherId ? a.teacherId === profile.teacherId : a.adminId === profile.adminId));
    const advanceDeduction = own.reduce((sum, a) => sum + Number(a.amount), 0);

    drafts.push({
      teacherId: profile.teacherId,
      adminId: profile.adminId,
      staffName: `${person.firstName} ${person.lastName}`,
      staffRole: isTeacher ? "Öğretmen" : "Yönetici",
      payType: profile.payType,
      hours,
      rate,
      baseAmount,
      // Avans, maaşı AŞAMAZ — kalan avans bir sonraki bordroya devreder
      // (aksi halde negatif net ücret çıkardı).
      advanceDeduction: Math.min(advanceDeduction, baseAmount),
      netAmount: Math.max(0, baseAmount - Math.min(advanceDeduction, baseAmount)),
      pendingAdvanceIds: own.map((a) => a.id),
    });
  }

  return drafts.sort((a, b) => b.netAmount - a.netAmount);
}
