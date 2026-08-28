// Gerçek bir "risk modeli" (ör. istatistiksel/ML tahmini) yok — bu yüzden
// RISK_RADAR mock'unun yerini, gerçek devam/net-trend/ödev sinyallerinden
// türetilen şeffaf bir kural-bazlı puan alır. computeAttendanceRate ve
// Aktiflik Skoru ile aynı "gerçek veriden türet, açıkça etiketle" ilkesi.
//
// RiskReason lib/mock-data.ts'te tanımlı (client bileşenlerin lib/server/*
// içe aktarmaması gerektiği için tek doğru kaynak orası — bkz. bu oturumun
// "server/ önek tuzağı" dersi) ve buradan sadece TİP olarak kullanılıyor.
import type { RiskReason } from "@/lib/mock-data";
export type { RiskReason };

export function computeRisk(input: {
  attendanceRate: number;
  homeworkSuccessRate: number | null;
  nets: number[]; // tarih sırasına göre (eskiden yeniye)
}): { riskScore: number; reason: RiskReason } {
  const attendancePenalty = Math.max(0, 100 - input.attendanceRate) * 0.4;
  const homeworkPenalty = Math.max(0, 100 - (input.homeworkSuccessRate ?? 100)) * 0.2;

  let netPenalty = 0;
  if (input.nets.length >= 2) {
    const mid = Math.max(1, Math.floor(input.nets.length / 2));
    const early = input.nets.slice(0, mid);
    const late = input.nets.slice(mid);
    const avgEarly = early.reduce((sum, n) => sum + n, 0) / early.length;
    const avgLate = late.reduce((sum, n) => sum + n, 0) / late.length;
    const declinePct = avgEarly > 0 ? ((avgEarly - avgLate) / avgEarly) * 100 : 0;
    netPenalty = Math.min(100, Math.max(0, declinePct)) * 0.4;
  }

  const riskScore = Math.round(Math.min(100, attendancePenalty + homeworkPenalty + netPenalty));

  // Üç cezadan en büyüğü asıl neden sayılır (eskiden devam+ödev cezaları
  // "study_gap" adı altında tek bir belirsiz etikette birleşiyordu — hangi
  // ikisinin gerçek neden olduğunu kaybediyordu). Eşitlikte net_drop > devam
  // > ödev öncelik sırası korunuyor (eski davranışla tutarlı).
  let reason: RiskReason = "net_drop";
  if (attendancePenalty > netPenalty && attendancePenalty >= homeworkPenalty) reason = "attendance_gap";
  else if (homeworkPenalty > netPenalty && homeworkPenalty > attendancePenalty) reason = "homework_gap";

  return { riskScore, reason };
}
