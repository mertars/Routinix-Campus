import { findMissingAttendance } from "@/lib/server/attendance/missing-attendance";
import { trPossessive } from "@/lib/tr-suffix";
import type { AgendaSource } from "../agenda-types";

// Yoklama günün en zamana duyarlı işi: ders geçtikten sonra girilen
// yoklama güvenilirliğini kaybeder. Bu yüzden tek başına "bugün".
export const ATTENDANCE_SOURCES: AgendaSource[] = [
  {
    key: "attendance-missing",
    horizon: "today",
    area: "attendance",
    urgency: "critical",
    tab: "attendance",
    async load(ctx) {
      const report = await findMissingAttendance(ctx.institutionId, ctx.now);
      if (report.missing.length === 0) return null;
      const students = report.missing.reduce((sum, m) => sum + m.studentCount, 0);
      return {
        count: report.missing.length,
        title: `${report.missing.length} derste yoklama girilmedi`,
        detail: `${report.dayName} · ${report.scheduledLessons} dersin ${trPossessive(report.missing.length)} eksik · ${students} öğrenci`,
      };
    },
  },
];
