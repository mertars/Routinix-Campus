// Gerçek bir "risk modeli" (ör. istatistiksel/ML tahmini) yok — bu yüzden
// RISK_RADAR mock'unun yerini, gerçek devam/net-trend/ödev sinyallerinden
// türetilen şeffaf bir kural-bazlı puan alır. computeAttendanceRate ve
// Aktiflik Skoru ile aynı "gerçek veriden türet, açıkça etiketle" ilkesi.
export type RiskReason = "net_drop" | "study_gap";

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
  const reason: RiskReason = netPenalty >= Math.max(attendancePenalty, homeworkPenalty) ? "net_drop" : "study_gap";

  return { riskScore, reason };
}
