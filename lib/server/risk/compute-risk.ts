// Gerçek bir "risk modeli" (ör. istatistiksel/ML tahmini) yok — bu yüzden
// RISK_RADAR mock'unun yerini, gerçek devam/net-trend/ödev/röntgen
// sinyallerinden türetilen şeffaf bir kural-bazlı puan alır. computeAttendanceRate
// ve Aktiflik Skoru ile aynı "gerçek veriden türet, açıkça etiketle" ilkesi.
//
// RiskReason lib/mock-data.ts'te tanımlı (client bileşenlerin lib/server/*
// içe aktarmaması gerektiği için tek doğru kaynak orası — bkz. bu oturumun
// "server/ önek tuzağı" dersi) ve buradan sadece TİP olarak kullanılıyor.
import type { RiskReason } from "@/lib/mock-data";
export type { RiskReason };

// Faz O — Akademik Röntgen'in TopicMasteryAssessment verisi 4. sinyal
// olarak eklendi ("3 sistemi birbirine bağlama" — devam/ödev [ERP],
// deneme net'i [Sınav sistemi], konu ustalığı [Akademik Röntgen] artık TEK
// bir risk skorunda birleşiyor). Ağırlıklar yeniden dengelendi (toplam
// yine 1.0): devam 0.3, ödev 0.15, net düşüşü 0.3, röntgen 0.25 — röntgen
// verisi olmayan (henüz hiç test edilmemiş) öğrenciler için bu terim 0
// olur, yani "veri yok" asla "riskli" ile karıştırılmaz (homeworkSuccessRate
// null davranışıyla AYNI ilke).
export function computeRisk(input: {
  attendanceRate: number;
  homeworkSuccessRate: number | null;
  nets: number[]; // tarih sırasına göre (eskiden yeniye)
  masteryScores: number[]; // Akademik Röntgen'deki TÜM güncel konu skorları (sırasız)
}): { riskScore: number; reason: RiskReason } {
  const attendancePenalty = Math.max(0, 100 - input.attendanceRate) * 0.3;
  const homeworkPenalty = Math.max(0, 100 - (input.homeworkSuccessRate ?? 100)) * 0.15;

  let netPenalty = 0;
  if (input.nets.length >= 2) {
    const mid = Math.max(1, Math.floor(input.nets.length / 2));
    const early = input.nets.slice(0, mid);
    const late = input.nets.slice(mid);
    const avgEarly = early.reduce((sum, n) => sum + n, 0) / early.length;
    const avgLate = late.reduce((sum, n) => sum + n, 0) / late.length;
    const declinePct = avgEarly > 0 ? ((avgEarly - avgLate) / avgEarly) * 100 : 0;
    netPenalty = Math.min(100, Math.max(0, declinePct)) * 0.3;
  }

  let masteryPenalty = 0;
  if (input.masteryScores.length > 0) {
    const avgMastery = input.masteryScores.reduce((sum, s) => sum + s, 0) / input.masteryScores.length;
    masteryPenalty = Math.max(0, 100 - avgMastery) * 0.25;
  }

  const riskScore = Math.round(Math.min(100, attendancePenalty + homeworkPenalty + netPenalty + masteryPenalty));

  // Dört cezadan en büyüğü asıl neden sayılır. Eşitlikte net_drop >
  // attendance_gap > mastery_gap > homework_gap öncelik sırası korunuyor
  // (eski 3'lü sıralamayla tutarlı, mastery_gap homework_gap'ten önce
  // eklendi çünkü ağırlığı daha büyük).
  let reason: RiskReason = "net_drop";
  if (attendancePenalty > netPenalty && attendancePenalty >= masteryPenalty && attendancePenalty >= homeworkPenalty) reason = "attendance_gap";
  else if (masteryPenalty > netPenalty && masteryPenalty > attendancePenalty && masteryPenalty >= homeworkPenalty) reason = "mastery_gap";
  else if (homeworkPenalty > netPenalty && homeworkPenalty > attendancePenalty && homeworkPenalty > masteryPenalty) reason = "homework_gap";

  return { riskScore, reason };
}
