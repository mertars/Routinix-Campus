import { prisma } from "@/lib/server/prisma";
import { toAttendanceDateKey } from "@/lib/attendance/date-key";

// "Bugün hangi derslerde yoklama GİRİLMEDİ?"
//
// Yoklama ekranı artık öğretmeni her öğrenciyi işaretlemeye zorluyor
// (bkz. components/teacher/tabs/live-attendance.tsx). Ama bu kural,
// ekranı HİÇ AÇMAYAN öğretmen için bir şey söylemez — yoklama sessizce
// hiç girilmemiş olur ve kimse fark etmez.
//
// Ders programı (LessonSlot) o gün hangi dersin olması gerektiğini
// zaten biliyor; eksikler bu iki kaynağın farkıdır.

// LessonSlot.day Türkçe gün adı tutar; JS'in getDay()'i 0=Pazar.
const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"] as const;

export function turkishDayName(date: Date): string {
  return DAY_NAMES[date.getDay()];
}

export type MissingAttendance = {
  branchId: string;
  branchName: string;
  subject: string;
  slot: string;
  teacherId: string;
  teacherName: string;
  /** O şubedeki aktif öğrenci sayısı — "kaç kişilik yoklama eksik". */
  studentCount: number;
};

export type MissingAttendanceReport = {
  date: string;
  dayName: string;
  scheduledLessons: number;
  missing: MissingAttendance[];
};

export async function findMissingAttendance(institutionId: string, date: Date): Promise<MissingAttendanceReport> {
  const dayName = turkishDayName(date);
  // Gün anahtarı tek yerden (bkz. lib/attendance/date-key.ts).
  const dayOnly = toAttendanceDateKey(date);

  const slots = await prisma.lessonSlot.findMany({
    where: { branch: { institutionId }, day: dayName },
    select: {
      branchId: true,
      subject: true,
      slot: true,
      teacherId: true,
      branch: { select: { name: true, _count: { select: { students: { where: { isActive: true } } } } } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });

  if (slots.length === 0) {
    return { date: dayOnly.toISOString(), dayName, scheduledLessons: 0, missing: [] };
  }

  // O güne ait TÜM yoklama kayıtları tek sorguda; ders başına sorgu
  // atmak 60 dersli bir günde 60 gidiş-geliş demekti.
  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: dayOnly,
      student: { institutionId },
    },
    select: { slot: true, student: { select: { branchId: true } } },
  });

  // Bir dersin yoklaması "girilmiş" sayılır: o şubede, o saat diliminde
  // EN AZ BİR kayıt varsa.
  //
  // Bu, kısmi girişin MÜMKÜN OLMAMASINA dayanır. Kural yazıldığında
  // yalnızca arayüzdeydi ve sunucu 15 kişilik sınıfa tek kayıtlık
  // gönderimi kabul ediyordu (ölçüldü) — yani bu varsayım yanlıştı ve
  // kısmi bir gönderim dersi "girildi" gösteriyordu. Kural artık
  // SUNUCUDA da zorunlu (bkz. app/api/attendance > roster kontrolü).
  const taken = new Set(records.map((r) => `${r.student.branchId}|${r.slot}`));

  const missing = slots
    .filter((s) => !taken.has(`${s.branchId}|${s.slot}`))
    .map(
      (s): MissingAttendance => ({
        branchId: s.branchId,
        branchName: s.branch.name,
        subject: s.subject,
        slot: s.slot,
        teacherId: s.teacherId,
        teacherName: `${s.teacher.firstName} ${s.teacher.lastName}`,
        studentCount: s.branch._count.students,
      })
    )
    // Saat sırasına göre: müdür günün akışını takip edebilsin.
    .sort((a, b) => a.slot.localeCompare(b.slot) || a.branchName.localeCompare(b.branchName, "tr-TR"));

  return { date: dayOnly.toISOString(), dayName, scheduledLessons: slots.length, missing };
}
