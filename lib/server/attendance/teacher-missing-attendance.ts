import { prisma } from "@/lib/server/prisma";
import { toAttendanceDateKey } from "@/lib/attendance/date-key";
import { turkishDayName } from "@/lib/server/attendance/missing-attendance";

// ----------------------------------------------------------------------------
// "UNUTULANLAR" — öğretmenin GEÇMİŞ günlerde girmediği kendi yoklamaları.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): yönetici Gündem'den "12 öğretmene
// hatırlat" diyordu, bildirim öğretmene ULAŞIYORDU (ölçüldü) ama öğretmen o
// yoklamayı GİREMİYORDU — yoklama ekranı yalnızca BUGÜNÜN ders saatlerini
// sunuyor. Yani hatırlatma döngüsü öğretmenin ucunda kopuyordu ve yöneticinin
// kartı sonsuza kadar "48 derste yoklama girilmedi" demeye devam ediyordu.
// Kullanıcının tarifi: "derste almadıysa almadığı yoklamayı sonradan
// ekleyebilsin, unutulanlar sekmesi yap, SADECE derse girip almadığı
// yoklamalar için".
//
// "Sadece kendi dersi" kısıtı burada YAPISAL: liste doğrudan LessonSlot'tan,
// teacherId eşleşmesiyle üretilir — öğretmen girmediği bir dersi bu ekranda
// göremez, dolayısıyla başkasının yoklamasını dolduramaz.
//
// ⚠️ Yoklama YAZMA ucu (app/api/attendance) geçmiş tarihi ZATEN kabul ediyor
// ve slot'u ders programına karşı doğruluyor — yani bu iş için yeni bir
// yazma yolu açılmadı, sadece var olanın önü açıldı.
// ----------------------------------------------------------------------------

/** Geriye dönük kaç gün taranır. 14 gün: bir haftayı kaçıran öğretmen bile yakalar,
 *  ama "iki ay önceki yoklamayı şimdi gir" gibi anlamsız bir kuyruk oluşmaz. */
export const MISSING_LOOKBACK_DAYS = 14;

export type MissedLesson = {
  /** YYYY-MM-DD — yoklama ucuna aynen gönderilir. */
  date: string;
  dayName: string;
  branchId: string;
  branchName: string;
  subject: string;
  slot: string;
  studentCount: number;
  /** Kaç gün önce — arayüz "dün", "3 gün önce" diye yazar. */
  daysAgo: number;
};

function isoDateKey(date: Date): string {
  return toAttendanceDateKey(date).toISOString().slice(0, 10);
}

export async function findTeacherMissedLessons(teacherId: string, today = new Date()): Promise<MissedLesson[]> {
  // Öğretmenin HAFTALIK programı — gün adı bazlı, tek sorgu.
  const slots = await prisma.lessonSlot.findMany({
    where: { teacherId },
    select: {
      branchId: true,
      day: true,
      slot: true,
      subject: true,
      branch: { select: { name: true, _count: { select: { students: { where: { isActive: true } } } } } },
    },
  });
  if (slots.length === 0) return [];

  // Taranacak günler: BUGÜN HARİÇ (bugünün dersi henüz "unutulmuş" sayılmaz,
  // öğretmen ders saatinde normal ekrandan giriyor) — dün ve öncesi.
  const days: { date: Date; key: string; name: string }[] = [];
  for (let back = 1; back <= MISSING_LOOKBACK_DAYS; back += 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - back);
    days.push({ date: toAttendanceDateKey(d), key: isoDateKey(d), name: turkishDayName(d) });
  }

  const slotsByDay = new Map<string, typeof slots>();
  for (const s of slots) {
    const list = slotsByDay.get(s.day) ?? [];
    list.push(s);
    slotsByDay.set(s.day, list);
  }

  // O aralıktaki TÜM yoklama kayıtları TEK sorguda — gün başına sorgu atmak
  // 14 gidiş-geliş demekti (bkz. missing-attendance.ts'teki aynı gerekçe).
  const branchIds = [...new Set(slots.map((s) => s.branchId))];
  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: days[days.length - 1].date, lte: days[0].date },
      student: { branchId: { in: branchIds } },
    },
    select: { date: true, slot: true, student: { select: { branchId: true } } },
  });
  const taken = new Set(records.map((r) => `${r.date.toISOString().slice(0, 10)}|${r.student.branchId}|${r.slot}`));

  const missed: MissedLesson[] = [];
  for (const [index, day] of days.entries()) {
    for (const s of slotsByDay.get(day.name) ?? []) {
      if (taken.has(`${day.key}|${s.branchId}|${s.slot}`)) continue;
      missed.push({
        date: day.key,
        dayName: day.name,
        branchId: s.branchId,
        branchName: s.branch.name,
        subject: s.subject,
        slot: s.slot,
        studentCount: s.branch._count.students,
        daysAgo: index + 1,
      });
    }
  }

  // En yeni önce — öğretmen dünden başlayıp geriye doğru kapatır.
  return missed.sort((a, b) => a.daysAgo - b.daysAgo || a.slot.localeCompare(b.slot));
}
