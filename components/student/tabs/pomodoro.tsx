"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Timer, Play, Pause, RotateCcw, Lock, Plus, Flame, BookOpenCheck } from "lucide-react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { cn } from "@/lib/utils";

// GİZLİLİK KURALI: Bu modüldeki tüm veriler (odak süresi, soru sayacı) SADECE
// tarayıcının localStorage'ında tutulur. lib/live-sync-context.tsx'e ASLA
// yazılmaz — öğretmen/yönetici panellerindeki hiçbir istatistiğe yansımaz.
const TARGET_QUESTIONS = 150;
const TARGET_SECONDS = 3 * 60 * 60;
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type DailyProgress = { day: string; questionsDone: number; focusSeconds: number; sessionsCompleted: number };

function emptyProgress(): DailyProgress {
  return { day: todayKey(), questionsDone: 0, focusSeconds: 0, sessionsCompleted: 0 };
}

export function PomodoroTab() {
  const [progress, setProgress] = useLocalStorageState<DailyProgress>("routinix-kampus-private-pomodoro", emptyProgress());
  const [mode, setMode] = useState<"work" | "break">("work");
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Gün değiştiyse sayaçları sıfırla (yerel gece yarısı reset'i).
  useEffect(() => {
    if (progress.day !== todayKey()) setProgress(emptyProgress());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (mode === "work") {
            setProgress((prev) => ({ ...prev, focusSeconds: prev.focusSeconds + WORK_SECONDS, sessionsCompleted: prev.sessionsCompleted + 1 }));
            setMode("break");
            return BREAK_SECONDS;
          }
          setMode("work");
          return WORK_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, setProgress]);

  function resetTimer() {
    setIsRunning(false);
    setMode("work");
    setSecondsLeft(WORK_SECONDS);
  }

  function addQuestions(count: number) {
    setProgress((prev) => ({ ...prev, questionsDone: prev.questionsDone + count }));
  }

  const questionProgress = Math.min(100, Math.round((progress.questionsDone / TARGET_QUESTIONS) * 100));
  const hourProgress = Math.min(100, Math.round((progress.focusSeconds / TARGET_SECONDS) * 100));
  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-brand-50 px-4 py-3 text-xs font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-600/10 dark:text-brand-300">
        <Lock className="h-4 w-4 shrink-0" /> Bu veriler sadece bu cihazda saklanır, öğretmen/yönetici panellerine yansımaz.
      </div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-6 text-center shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <p className={cn("mb-1 text-xs font-semibold uppercase tracking-widest", mode === "work" ? "text-brand-600" : "text-green-600 dark:text-green-400")}>
          {mode === "work" ? "Odaklanma Süresi" : "Mola Zamanı"}
        </p>
        <motion.p key={mode} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-6xl font-bold tabular-nums text-espresso dark:text-cream">
          {minutes}:{seconds}
        </motion.p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            onClick={() => setIsRunning((r) => !r)}
            className="flex min-h-[52px] min-w-[140px] items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {isRunning ? "Duraklat" : "Başlat"}
          </button>
          <button onClick={resetTimer} className="flex min-h-[52px] w-[52px] items-center justify-center rounded-2xl border border-hairline text-espresso dark:border-white/10 dark:text-cream">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[11px] text-espresso-muted dark:text-cream/40">Bugün tamamlanan oturum: {progress.sessionsCompleted}</p>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Timer className="h-4 w-4 text-brand-600" /> Günlük Hedeflerim
        </h2>

        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-espresso dark:text-cream"><BookOpenCheck className="h-3.5 w-3.5 text-brand-600" /> Soru Hedefi</span>
            <span className="text-espresso-muted dark:text-cream/40">{progress.questionsDone} / {TARGET_QUESTIONS}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
            <motion.div className="h-full rounded-full bg-brand-600" animate={{ width: `${questionProgress}%` }} transition={{ type: "spring", stiffness: 80, damping: 16 }} />
          </div>
          <div className="mt-2 flex gap-1.5">
            {[1, 5, 10].map((n) => (
              <button key={n} onClick={() => addQuestions(n)} className="flex min-h-[32px] items-center gap-1 rounded-full bg-cream-card px-3 text-[11px] font-medium text-espresso transition hover:bg-brand-50 hover:text-brand-700 dark:bg-white/5 dark:text-cream dark:hover:bg-brand-600/15">
                <Plus className="h-3 w-3" /> {n} Soru
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-espresso dark:text-cream"><Flame className="h-3.5 w-3.5 text-brand-600" /> Çalışma Süresi Hedefi</span>
            <span className="text-espresso-muted dark:text-cream/40">{(progress.focusSeconds / 3600).toFixed(1)} sa / 3 sa</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
            <motion.div className="h-full rounded-full bg-green-600" animate={{ width: `${hourProgress}%` }} transition={{ type: "spring", stiffness: 80, damping: 16 }} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
