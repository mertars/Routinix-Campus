"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, CalendarCheck, FileCheck2, Bell, Radio, Clock, Zap } from "lucide-react";
import { type ScheduleAssignment, type ScheduleDay, type ScheduleSlot } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useCurrentLesson } from "@/lib/teacher-scope";
import { useActiveQuiz } from "@/lib/use-active-quiz";
import { ExamCountdownCard } from "@/components/student/exam-countdown-card";

type HomeworkSubmission = { studentId: string; status: "NOT_DONE" | "HALF" | "DONE" | "LATE" };
type HomeworkEntry = { id: string; submissions: HomeworkSubmission[] };

export function OverviewTab({ onNavigate = () => {} }: { onNavigate?: (tabId: string) => void }) {
  const { studentId, branchId, report } = useStudentScope();

  const [mySchedule, setMySchedule] = useState<ScheduleAssignment[]>([]);
  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/lesson-slots?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => {
        setMySchedule(
          (data.slots ?? []).map((s: { id: string; branchId: string; day: string; slot: string; subject: string; teacherName: string }) => ({
            id: s.id,
            branchId: s.branchId,
            day: s.day as ScheduleDay,
            slot: s.slot as ScheduleSlot,
            teacherName: s.teacherName,
            subject: s.subject,
          }))
        );
      })
      .catch(() => {
        // sessiz — ders programı boş görünür
      });
  }, [branchId]);
  const lesson = useCurrentLesson(mySchedule);
  const { quiz: activeQuiz, alreadySubmitted } = useActiveQuiz(branchId, studentId);
  const hasLiveQuiz = !!activeQuiz && !alreadySubmitted;

  const [pendingHomeworkCount, setPendingHomeworkCount] = useState(0);
  const [pendingAppointments, setPendingAppointments] = useState(0);
  const [latestAnnouncementTitle, setLatestAnnouncementTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/homework?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => {
        const homeworks: HomeworkEntry[] = data.homeworks ?? [];
        const pending = homeworks.filter((item) => {
          const status = item.submissions.find((s) => s.studentId === studentId)?.status ?? "NOT_DONE";
          return status === "NOT_DONE" || status === "HALF";
        }).length;
        setPendingHomeworkCount(pending);
      })
      .catch(() => {
        // sessiz — kart 0 gösterir
      });
  }, [branchId, studentId]);

  useEffect(() => {
    fetch(`/api/appointments?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => {
        const pending = (data.appointments ?? []).filter((a: { status: string }) => a.status === "PENDING").length;
        setPendingAppointments(pending);
      })
      .catch(() => {
        // sessiz — kart 0 gösterir
      });
  }, [studentId]);

  useEffect(() => {
    fetch(`/api/announcements?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setLatestAnnouncementTitle(data.announcements?.[0]?.title ?? null))
      .catch(() => {
        // sessiz — kart "Duyuru yok" gösterir
      });
  }, [studentId]);

  return (
    <div className="space-y-4">
      {hasLiveQuiz && (
        <motion.button
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => onNavigate("pop-quiz")}
          className="flex w-full items-center gap-3 rounded-2xl border border-brand-500/40 bg-brand-600 p-4 text-left text-white shadow-lg"
        >
          <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1, repeat: Infinity }} className="shrink-0">
            <Zap className="h-6 w-6" />
          </motion.span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Yeni Pop-Quiz Geldi!</p>
            <p className="truncate text-sm font-bold">{activeQuiz?.name}</p>
          </div>
        </motion.button>
      )}

      <ExamCountdownCard />

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className={
          lesson.isLive
            ? "flex items-center gap-2 rounded-2xl bg-green-600 p-4 text-sm font-semibold text-white shadow-sm"
            : "flex items-center gap-2 rounded-2xl border border-hairline bg-white/70 p-4 text-sm font-medium text-espresso-muted backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70 dark:text-cream/40"
        }
      >
        {lesson.isLive ? (
          <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <Radio className="h-4 w-4" />
          </motion.span>
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {lesson.isLive
          ? `Şu An Canlı: ${lesson.subject} (${lesson.slot})`
          : lesson.branchName
            ? `Sıradaki Ders: ${lesson.subject} · ${lesson.day} ${lesson.slot}`
            : "Bugün için planlanmış ders yok"}
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onNavigate("net-tracker")} className="rounded-2xl border border-hairline bg-white/70 p-4 text-left backdrop-blur-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/70 dark:hover:bg-white/5">
          <Target className="mb-1.5 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{report.actualNet}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">Güncel Net (Hedef {report.targetNet})</p>
        </button>
        <button onClick={() => onNavigate("homework")} className="rounded-2xl border border-hairline bg-white/70 p-4 text-left backdrop-blur-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/70 dark:hover:bg-white/5">
          <FileCheck2 className="mb-1.5 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{pendingHomeworkCount}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">Bekleyen Ödev</p>
        </button>
        <button onClick={() => onNavigate("etut")} className="rounded-2xl border border-hairline bg-white/70 p-4 text-left backdrop-blur-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/70 dark:hover:bg-white/5">
          <CalendarCheck className="mb-1.5 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{pendingAppointments}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">Onay Bekleyen Randevu</p>
        </button>
        <button onClick={() => onNavigate("announcements")} className="rounded-2xl border border-hairline bg-white/70 p-4 text-left backdrop-blur-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/70 dark:hover:bg-white/5">
          <Bell className="mb-1.5 h-4 w-4 text-brand-600" />
          <p className="truncate text-xs font-semibold text-espresso dark:text-cream">{latestAnnouncementTitle ?? "Duyuru yok"}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">Son Duyuru</p>
        </button>
      </div>
    </div>
  );
}
