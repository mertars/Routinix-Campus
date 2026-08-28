"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Radio, Clock, Maximize2 } from "lucide-react";
import { type ScheduleAssignment, type ScheduleDay } from "@/lib/mock-data";
import { parseSlotRange } from "@/lib/schedule-time";
import { useStudentScope } from "@/lib/student-scope";
import { useCurrentLesson } from "@/lib/teacher-scope";
import { FullWeekScheduleModal } from "@/components/student/full-week-schedule-modal";
import { cn } from "@/lib/utils";

// Öğretmen panelindeki (lib/teacher-scope.ts > useCurrentLesson) JS gün
// indeksi -> TR gün adı eşlemesiyle AYNI — hafta sonu (Pazar/Cumartesi)
// dershanenin ders programında yok.
const JS_DAY_TO_TR: Record<number, ScheduleDay | null> = {
  0: null,
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: null,
};

type RawSlot = { id: string; branchId: string; branchName: string; day: string; slot: string; subject: string; teacherName: string };

// Eski dev "YKS Geri Sayımı" kartının yerini alan widget — sayaç artık
// StudentHero'da küçük bir kapsül (bkz. exam-countdown-card.tsx > ExamCountdownChip),
// bu yüzden ana içerik alanı BUGÜNÜN gerçek ders programını gösterir.
// "Tüm Programı Gör" butonu, öğretmen panelindeki AYNI WeeklyGrid'i kullanan
// tam haftalık bir modal açar (bkz. full-week-schedule-modal.tsx).
export function TodayScheduleCard() {
  const { branchId } = useStudentScope();
  const [mySchedule, setMySchedule] = useState<ScheduleAssignment[]>([]);
  const [todayTR, setTodayTR] = useState<ScheduleDay | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isWeekModalOpen, setIsWeekModalOpen] = useState(false);

  // Sunucu prerender anı ile istemcinin hydrate olduğu an farklı "bugün"e
  // denk gelebilir (saat dilimi/zamanlama) — bu yüzden "bugün" değeri
  // sadece mount sonrası effect'te hesaplanır (bkz. exam-countdown-card.tsx'teki
  // aynı güvenli desen).
  useEffect(() => {
    setTodayTR(JS_DAY_TO_TR[new Date().getDay()] ?? null);
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/lesson-slots?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => {
        setMySchedule(
          (data.slots ?? []).map((s: RawSlot) => ({
            id: s.id,
            branchId: s.branchId,
            branchName: s.branchName,
            day: s.day as ScheduleDay,
            slot: s.slot,
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

  const todaysLessons = todayTR
    ? mySchedule.filter((row) => row.day === todayTR).sort((a, b) => parseSlotRange(a.slot)[0] - parseSlotRange(b.slot)[0])
    : [];

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarDays className="h-4 w-4 text-brand-600" /> Bugünün Ders Programı
        </h2>
        <button
          onClick={() => setIsWeekModalOpen(true)}
          className="flex shrink-0 items-center gap-1 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-[11px] font-semibold text-brand-700 backdrop-blur-sm transition hover:bg-brand-500/20 dark:text-brand-300"
        >
          <Maximize2 className="h-3 w-3" /> Tüm Programı Gör
        </button>
      </div>

      {!hasMounted ? null : todaysLessons.length === 0 ? (
        <p className="rounded-2xl bg-cream-card px-4 py-6 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          {todayTR ? "Bugün için planlanmış ders yok." : "Hafta sonu — planlanmış ders yok."}
        </p>
      ) : (
        <div className="space-y-2">
          {todaysLessons.map((row) => {
            const isLive = lesson.isLive && lesson.slot === row.slot && lesson.subject === row.subject;
            return (
              <div
                key={row.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
                  isLive ? "bg-green-600 text-white shadow-sm" : "bg-cream-card dark:bg-white/5"
                )}
              >
                {isLive ? (
                  <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="shrink-0">
                    <Radio className="h-4 w-4" />
                  </motion.span>
                ) : (
                  <Clock className="h-4 w-4 shrink-0 text-brand-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm font-semibold", isLive ? "text-white" : "text-espresso dark:text-cream")}>{row.subject}</p>
                  <p className={cn("truncate text-[11px]", isLive ? "text-white/70" : "text-espresso-muted dark:text-cream/40")}>{row.teacherName}</p>
                </div>
                <span className={cn("shrink-0 text-xs font-medium tabular-nums", isLive ? "text-white/90" : "text-espresso-muted dark:text-cream/50")}>
                  {row.slot}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <FullWeekScheduleModal isOpen={isWeekModalOpen} onClose={() => setIsWeekModalOpen(false)} schedule={mySchedule} />
    </motion.div>
  );
}
