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

export function computeAttendanceRate(records: { status: string }[]): number {
  const counted = records.filter((r) => !EXCLUDED_FROM_RATE.includes(r.status as AttendanceStatus));
  if (counted.length === 0) return 100;
  const positive = counted.filter((r) => POSITIVE_STATUSES.includes(r.status as AttendanceStatus)).length;
  return Math.round((positive / counted.length) * 100);
}

export function isValidAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}
