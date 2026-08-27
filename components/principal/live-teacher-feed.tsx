"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Radio, LifeBuoy, Rocket, AlertOctagon } from "lucide-react";

type AttendanceEntry = { id: string; teacherName: string; branchName: string; records: unknown[]; submittedAt: string };
type QuizFeedEntry = { id: string; quizName: string; branchName: string; responseCount: number; sentAt: string };
type LateSubmission = { studentName: string; updatedAt: string };
type GuidanceFeedEntry = { id: string; authorName: string; studentName: string; createdAt: string };

export function LiveTeacherFeed() {
  const [attendanceLog, setAttendanceLog] = useState<AttendanceEntry[]>([]);
  const [quizResults, setQuizResults] = useState<QuizFeedEntry[]>([]);
  const [lateSubmissions, setLateSubmissions] = useState<LateSubmission[]>([]);
  const [guidanceNotices, setGuidanceNotices] = useState<GuidanceFeedEntry[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [attendanceRes, quizRes, homeworkRes, guidanceRes] = await Promise.all([
          fetch("/api/attendance/archive?limit=4"),
          fetch("/api/quizzes?feed=true&limit=4"),
          fetch("/api/homework?late=true&limit=4"),
          fetch("/api/guidance-notes?feed=true&limit=4"),
        ]);
        const [attendanceData, quizData, homeworkData, guidanceData] = await Promise.all([
          attendanceRes.json(),
          quizRes.json(),
          homeworkRes.json(),
          guidanceRes.json(),
        ]);
        setAttendanceLog(attendanceData.entries ?? []);
        setQuizResults(quizData.results ?? []);
        setLateSubmissions(homeworkData.submissions ?? []);
        setGuidanceNotices(guidanceData.notes ?? []);
      } catch {
        // sessiz — kartlar "henüz yok" durumunda kalır
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Radio className="h-4 w-4 text-brand-600" /> Canlı Öğretmen Akışı
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            <Radio className="h-3 w-3" /> Yoklama Bildirimleri
          </p>
          <div className="space-y-1.5">
            {attendanceLog.slice(0, 4).map((entry) => (
              <div key={entry.id} className="rounded-lg bg-cream-card px-2.5 py-1.5 text-xs dark:bg-white/5">
                <span className="font-medium text-espresso dark:text-cream">{entry.teacherName}</span>{" "}
                <span className="text-espresso-muted dark:text-cream/40">
                  · {entry.branchName} · {entry.records.length} öğrenci · {new Date(entry.submittedAt).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
            {attendanceLog.length === 0 && <p className="text-[11px] text-espresso-muted dark:text-cream/40">Henüz bildirim yok.</p>}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            <LifeBuoy className="h-3 w-3" /> Rehberlik Sevkleri
          </p>
          <div className="space-y-1.5">
            {guidanceNotices.slice(0, 4).map((notice) => (
              <div key={notice.id} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs dark:bg-rose-500/10">
                <span className="font-medium text-espresso dark:text-cream">{notice.authorName}</span>{" "}
                <span className="text-espresso-muted dark:text-cream/40">
                  , {notice.studentName} için görüşme tavsiye etti · {new Date(notice.createdAt).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
            {guidanceNotices.length === 0 && <p className="text-[11px] text-espresso-muted dark:text-cream/40">Henüz sevk bildirimi yok.</p>}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            <Rocket className="h-3 w-3" /> Pop-Quiz Sonuçları
          </p>
          <div className="space-y-1.5">
            {quizResults.slice(0, 4).map((result) => (
              <div key={result.id} className="rounded-lg bg-cream-card px-2.5 py-1.5 text-xs dark:bg-white/5">
                <span className="font-medium text-espresso dark:text-cream">{result.quizName}</span>{" "}
                <span className="text-espresso-muted dark:text-cream/40">
                  · {result.branchName} · {result.responseCount} yanıt · {new Date(result.sentAt).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
            {quizResults.length === 0 && <p className="text-[11px] text-espresso-muted dark:text-cream/40">Henüz sonuç gelmedi.</p>}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            <AlertOctagon className="h-3 w-3" /> Geç Teslim Güncellemeleri
          </p>
          <div className="space-y-1.5">
            {lateSubmissions.slice(0, 4).map((row, index) => (
              <div key={`${row.studentName}-${index}`} className="rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs dark:bg-purple-500/10">
                <span className="font-medium text-espresso dark:text-cream">{row.studentName}</span>{" "}
                <span className="text-espresso-muted dark:text-cream/40">geç teslim etti · {new Date(row.updatedAt).toLocaleString("tr-TR")}</span>
              </div>
            ))}
            {lateSubmissions.length === 0 && <p className="text-[11px] text-espresso-muted dark:text-cream/40">Geç teslim bildirimi yok.</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
