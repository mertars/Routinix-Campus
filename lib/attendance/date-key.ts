// Yoklama tarihi anahtarı — TEK tanım.
//
// AttendanceRecord.date bir ZAMAN DAMGASI değil, bir GÜN anahtarıdır
// (@@unique([studentId, date, slot])). Bu yüzden her zaman UTC gece
// yarısı olarak kurulur ve SUNUCUNUN SAAT DİLİMİNE BAĞLI OLMAZ.
//
// ⚠️ Bu dosya, gerçek bir veri bozulmasından sonra yazıldı. Yazma ve
// okuma uçlarının ikisi de şunu yapıyordu:
//
//     const date = new Date(value);   // UTC gece yarısı
//     date.setHours(0, 0, 0, 0);      // YEREL gece yarısı
//
// Sunucu UTC+3'te çalıştığında bu, tarihi bir gün geriye kaydırıyordu:
// 2026-09-09 kaydı 2026-09-08T21:00Z olarak saklanıyordu. Yazma ve
// okuma AYNI kaymayı yaptığı için hata yıllarca görünmezdi; ancak UTC
// ile sorgulayan yeni bir rapor (girilmeyen yoklama) eklendiğinde
// ortaya çıktı: rapor, yoklaması girilmiş dersleri "eksik" gösteriyordu.
//
// Ölçüldü: 3.893 kaydın 1.946'sı kaymış haldeydi (hepsi tam 21:00Z).
//
// Hata ORTAMA BAĞLIYDI — Vercel UTC'de çalıştığı için orada
// görünmüyor, yerel geliştirmede ve UTC dışı bir sunucuda veriyi
// bozuyordu. Doğruluğun ortama bağlı olması, hatanın kendisinden daha
// tehlikelidir.

/** "YYYY-MM-DD" → o günün UTC gece yarısı. Geçersizse Invalid Date. */
export function parseAttendanceDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(NaN);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Bir Date'i (hangi saatte olursa olsun) UTC gün anahtarına indirger. */
export function toAttendanceDateKey(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Bugünün UTC gün anahtarı. */
export function todayAttendanceKey(): Date {
  return toAttendanceDateKey(new Date());
}
