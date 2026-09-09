// Yoklama durumları — SUNUCU BAĞIMLILIĞI YOK, hem route'lar hem
// öğretmen/yönetici ekranları buradan okur.
//
// Bu dosya var çünkü durumlar ("PRESENT"/"ABSENT"/"LATE") ve devam oranı
// kuralı SEKİZ ayrı yere elle yazılmıştı; "İzinli" eklenirken birinin
// unutulması, mazeretli öğrencinin bir ekranda devamsız görünmesi
// demekti.

export type AttendanceStatus = "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "LATE", "EXCUSED", "ABSENT"];

export const ATTENDANCE_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Geldi",
  LATE: "Geç",
  EXCUSED: "İzinli",
  ABSENT: "Yok",
};

// Devam oranına OLUMLU sayılanlar. İzinli burada YOK — ama devamsız da
// sayılmaz; aşağıdaki EXCLUDED_FROM_RATE ile paydadan düşer.
export const POSITIVE_STATUSES: readonly AttendanceStatus[] = ["PRESENT", "LATE"];

// Devam oranı hesabının DIŞINDA tutulan durumlar.
//
// Raporlu/resmi izinli bir öğrenci ne "geldi" sayılmalı (oranı şişirir,
// gerçeği gizler) ne de "gelmedi" sayılmalı (mazereti olan öğrenciyi
// cezalandırır). Doğrusu paydadan düşmektir: 10 dersin 2'sinde raporlu,
// 8'inde gelen öğrencinin devam oranı %100'dür.
export const EXCLUDED_FROM_RATE: readonly AttendanceStatus[] = ["EXCUSED"];

// Durum → adet eşlemesinden devam oranı.
//
// Bu varyant var çünkü oranı hesaplamak için satırların KENDİSİ gerekmez,
// yalnızca sayıları gerekir. Veli paneli bir öğrencinin ÜÇ YILLIK tüm
// yoklama kayıtlarını (ölçüldü: 1.925 satır) sadece bu oranı bulmak için
// çekiyordu. groupBy ile aynı sonuç, sabit maliyetle elde edilir.
//
// Kural TEK yerde kalsın diye satır tabanlı sürüm de buraya delege eder.
export function computeAttendanceRateFromCounts(counts: Record<string, number>): number {
  let counted = 0;
  let positive = 0;
  for (const [status, n] of Object.entries(counts)) {
    if (EXCLUDED_FROM_RATE.includes(status as AttendanceStatus)) continue;
    counted += n;
    if (POSITIVE_STATUSES.includes(status as AttendanceStatus)) positive += n;
  }
  if (counted === 0) return 100;
  return Math.round((positive / counted) * 100);
}

export function computeAttendanceRate(records: { status: string }[]): number {
  const counts: Record<string, number> = {};
  for (const r of records) counts[r.status] = (counts[r.status] ?? 0) + 1;
  return computeAttendanceRateFromCounts(counts);
}

export function isValidAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}
