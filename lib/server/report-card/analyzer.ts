import type { ReportCardAnalysis, SubjectNetSummary } from "./types";

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeSubjectSummaries(
  studentNets: { subject: string; net: number }[],
  classAverages: Record<string, number>
): SubjectNetSummary[] {
  return studentNets.map((entry) => {
    const classAverageNet = classAverages[entry.subject] ?? entry.net;
    return {
      subject: entry.subject,
      studentNet: round2(entry.net),
      classAverageNet: round2(classAverageNet),
      delta: round2(entry.net - classAverageNet),
    };
  });
}

export function computeAttendanceRate(records: { status: string }[]): number {
  if (records.length === 0) return 100;
  const presentOrLate = records.filter((record) => record.status === "PRESENT" || record.status === "LATE").length;
  return Math.round((presentOrLate / records.length) * 100);
}

// Kural bazlı, yapay zeka KULLANMAYAN otomatik rehberlik notu üreteci.
// Eşik değerleri (±5 net, %95/%80 devam) sabit kurallardır — istenirse
// kurum bazlı yapılandırılabilir hale getirilebilir.
export function generateGuidanceNotes(subjectSummaries: SubjectNetSummary[], attendanceRate: number): string[] {
  const notes: string[] = [];

  for (const summary of subjectSummaries) {
    if (summary.delta <= -5) {
      notes.push(`${summary.subject} branşında sınıf ortalamasının belirgin altında kalınmış — etüt planlanmalı.`);
    } else if (summary.delta >= 5) {
      notes.push(`${summary.subject} branşında sınıf ortalamasının üzerinde başarılı bir performans sergilenmiş.`);
    }
  }

  if (attendanceRate >= 95) {
    notes.push("Devam ve disiplin durumu yüksek seviyede — örnek katılım gösteriyor.");
  } else if (attendanceRate < 80) {
    notes.push("Devamsızlık oranı dikkat çekici düzeyde — veli görüşmesi planlanmalı.");
  }

  if (notes.length === 0) {
    notes.push("Genel performans dengeli seyrediyor, mevcut çalışma temposu sürdürülmeli.");
  }

  return notes;
}

export function buildReportCardAnalysis(
  studentNets: { subject: string; net: number }[],
  classAverages: Record<string, number>,
  attendanceRecords: { status: string }[]
): ReportCardAnalysis {
  const subjectSummaries = computeSubjectSummaries(studentNets, classAverages);
  const attendanceRate = computeAttendanceRate(attendanceRecords);
  const guidanceNotes = generateGuidanceNotes(subjectSummaries, attendanceRate);
  return { attendanceRate, subjectSummaries, guidanceNotes };
}
