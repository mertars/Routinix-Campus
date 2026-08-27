"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, User, BookOpen, CalendarClock } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  teacherName: string;
  subject: string;
  studentName: string;
  topic: string;
  startTime: string;
  endTime: string;
  status: "live" | "upcoming" | "completed";
  remainingSeconds: number;
};

type LiveTutoringData = {
  stats: { completedToday: number; liveNow: number; avgDurationMinutes: number };
  liveGrid: Session[];
  upcoming: Session[];
};

function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => setSeconds(initialSeconds), [initialSeconds]);
  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => (value > 0 ? value - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function LiveSessionCard({ session, index }: { session: Session; index: number }) {
  const isLive = session.status === "live";
  const remaining = useCountdown(session.remainingSeconds ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.015, y: -3 }}
      className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-espresso dark:text-cream">{session.teacherName}</p>
        <span className="relative flex h-2.5 w-2.5">
          {isLive && (
            <motion.span
              className="absolute inline-flex h-full w-full rounded-full bg-green-400"
              animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
            />
          )}
          <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", isLive ? "bg-green-600" : "bg-rose-400")} />
        </span>
      </div>
      <p className="mb-3 text-xs text-espresso-muted dark:text-cream/40">{session.subject}</p>

      {isLive ? (
        <div className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
          <div className="flex items-center gap-1.5 text-xs text-espresso dark:text-cream">
            <User className="h-3.5 w-3.5 text-brand-600" /> {session.studentName}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-espresso-muted dark:text-cream/50">
            <BookOpen className="h-3.5 w-3.5 text-brand-600" /> {session.topic}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-espresso-muted dark:text-cream/40">
              {session.startTime} - {session.endTime}
            </span>
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
              {formatCountdown(remaining)} dk Kaldı
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl bg-cream-card py-4 text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          Şu an aktif etüt yok
        </div>
      )}
    </motion.div>
  );
}

export function LiveTutoringTab() {
  const { showError } = useToast();
  const [data, setData] = useState<LiveTutoringData>({ stats: { completedToday: 0, liveNow: 0, avgDurationMinutes: 0 }, liveGrid: [], upcoming: [] });

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/admin/live-tutoring")
        .then((res) => res.json())
        .then((json) => {
          if (!cancelled) setData(json);
        })
        .catch(() => showError("Canlı etüt verisi yüklenemedi."));
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <p className="text-2xl font-semibold text-espresso dark:text-cream">{data.stats.completedToday}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Bugün Tamamlanan Etüt</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{data.stats.liveNow}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Şu An Canlı</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <p className="text-2xl font-semibold text-espresso dark:text-cream">{data.stats.avgDurationMinutes} dk</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Ortalama Süre</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Clock className="h-4 w-4 text-brand-600" /> Canlı Trafik Izgarası
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.liveGrid.map((session, index) => (
            <LiveSessionCard key={session.id} session={session} index={index} />
          ))}
          {data.liveGrid.length === 0 && (
            <p className="col-span-full text-xs text-espresso-muted dark:text-cream/40">Bugün için onaylanmış etüt yok.</p>
          )}
        </div>
      </div>

      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarClock className="h-4 w-4 text-brand-600" /> Yaklaşan Randevular
        </h2>
        <div className="space-y-2">
          {data.upcoming.map((appointment, index) => (
            <motion.div
              key={appointment.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
            >
              <div>
                <p className="text-sm font-medium text-espresso dark:text-cream">
                  {appointment.studentName} <span className="text-espresso-muted dark:text-cream/40">· {appointment.teacherName}</span>
                </p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{appointment.topic}</p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-espresso dark:bg-white/10 dark:text-cream">
                {appointment.startTime}
              </span>
            </motion.div>
          ))}
          {data.upcoming.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bugün için yaklaşan randevu yok.</p>}
        </div>
      </motion.div>
    </div>
  );
}
