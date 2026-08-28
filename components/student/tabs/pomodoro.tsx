"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Lock,
  Plus,
  Flame,
  BookOpenCheck,
  Target,
  Sparkles,
  CheckCircle2,
  Circle,
  History,
  Loader2,
} from "lucide-react";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

// GİZLİLİK KURALI: odak süresi/soru sayacı yerelde kalır (lib/live-sync-
// context.tsx'e ASLA yazılmaz). Hedefler artık kalıcı olması için Prisma'da
// tutuluyor (bkz. StudyGoal/StudyTopicGoal) — ama o veriye de SADECE
// öğrencinin kendisi erişebiliyor, öğretmen/yönetici tarafı hiç göremiyor.
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

type DailyProgress = { day: string; questionsDone: number; focusSeconds: number; sessionsCompleted: number };

function emptyProgress(): DailyProgress {
  return { day: todayKey(), questionsDone: 0, focusSeconds: 0, sessionsCompleted: 0 };
}

type TopicGoal = {
  id: string;
  title: string;
  description: string | null;
  targetMinutes: number | null;
  targetQuestions: number | null;
  progressMinutes: number;
  progressQuestions: number;
  isCompleted: boolean;
};

type StudyGoal = {
  id: string;
  targetQuestions: number | null;
  targetMinutes: number | null;
  progressQuestions: number;
  progressMinutes: number;
  isCompleted: boolean;
  createdAt: string;
  completedAt: string | null;
  topicGoals: TopicGoal[];
};

function pct(progress: number, target: number | null) {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((progress / target) * 100));
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
      <motion.div className="h-full rounded-full bg-brand-600" animate={{ width: `${value}%` }} transition={{ type: "spring", stiffness: 80, damping: 16 }} />
    </div>
  );
}

function GoalSummaryLine({ goal }: { goal: StudyGoal }) {
  const parts: string[] = [];
  if (goal.targetQuestions) parts.push(`${goal.progressQuestions}/${goal.targetQuestions} soru`);
  if (goal.targetMinutes) parts.push(`${goal.progressMinutes}/${goal.targetMinutes} dk`);
  return <span>{parts.length > 0 ? parts.join(" · ") : "Hedef girilmedi"}</span>;
}

function GoalCreateModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (goal: StudyGoal) => void }) {
  const { showError, showSuccess } = useToast();
  const [questions, setQuestions] = useState("150");
  const [minutes, setMinutes] = useState("180");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/study-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetQuestions: questions.trim() === "" ? null : Number(questions),
          targetMinutes: minutes.trim() === "" ? null : Number(minutes),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Hedef oluşturulamadı.");
      onCreated(data.goal);
      showSuccess("Yeni hedefin belirlendi!");
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hedef oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Hedef Belirle">
      <div className="space-y-3">
        <p className="text-xs text-espresso-muted dark:text-cream/40">
          Aktif bir hedefin varsa otomatik tamamlanıp Geçmiş Hedeflerim&apos;e taşınır.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Soru Hedefi</span>
            <input
              type="number" min={0} max={5000} value={questions} onChange={(e) => setQuestions(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Süre Hedefi (dk)</span>
            <input
              type="number" min={0} max={5000} value={minutes} onChange={(e) => setMinutes(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </label>
        </div>
        <button
          onClick={submit}
          disabled={saving}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-70 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />} {saving ? "Kaydediliyor..." : "Hedefi Başlat"}
        </button>
      </div>
    </Modal>
  );
}

function TopicGoalAddForm({ onAdd }: { onAdd: (data: { title: string; description: string; targetMinutes: string; targetQuestions: string }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetMinutes, setTargetMinutes] = useState("");
  const [targetQuestions, setTargetQuestions] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onAdd({ title, description, targetMinutes, targetQuestions });
      setTitle("");
      setDescription("");
      setTargetMinutes("");
      setTargetQuestions("");
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-hairline text-xs font-medium text-espresso-muted transition hover:border-brand-600/40 hover:text-brand-600 dark:border-white/15 dark:text-cream/40"
      >
        <Plus className="h-3.5 w-3.5" /> Özel Konu/Görev Hedefi Ekle
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl bg-cream-card p-3 dark:bg-white/5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Konu/Görev (örn. Trigonometri)"
        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number" min={0} value={targetMinutes} onChange={(e) => setTargetMinutes(e.target.value)} placeholder="Dakika"
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <input
          type="number" min={0} value={targetQuestions} onChange={(e) => setTargetQuestions(e.target.value)} placeholder="Soru"
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Açıklama (isteğe bağlı, örn. Çıkmış sorular çözülecek)"
        rows={2}
        className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      />
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setOpen(false)} className="flex min-h-[36px] items-center justify-center rounded-lg border border-hairline text-xs font-medium text-espresso dark:border-white/10 dark:text-cream">
          Vazgeç
        </button>
        <button
          onClick={submit}
          disabled={!title.trim() || saving}
          className="flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg bg-espresso text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ekle"}
        </button>
      </div>
    </div>
  );
}

function TopicGoalRow({ topic, onAddQuestions, onComplete }: { topic: TopicGoal; onAddQuestions: (n: number) => void; onComplete: () => void }) {
  return (
    <div className={cn("rounded-xl p-3", topic.isCompleted ? "bg-green-50 dark:bg-green-500/10" : "bg-cream-card dark:bg-white/5")}>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-espresso dark:text-cream">{topic.title}</p>
          {topic.description && <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">{topic.description}</p>}
        </div>
        {topic.isCompleted && <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />}
      </div>
      <p className="mb-1.5 text-[10px] text-espresso-muted dark:text-cream/40"><GoalSummaryLine goal={{ ...topic } as unknown as StudyGoal} /></p>
      {!topic.isCompleted && (
        <div className="flex flex-wrap gap-1.5">
          {topic.targetQuestions !== null && [1, 5].map((n) => (
            <button key={n} onClick={() => onAddQuestions(n)} className="flex min-h-[30px] items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-medium text-espresso transition hover:bg-brand-50 hover:text-brand-700 dark:bg-midnight-card dark:text-cream dark:hover:bg-brand-600/15">
              <Plus className="h-2.5 w-2.5" /> {n} Soru
            </button>
          ))}
          <button onClick={onComplete} className="flex min-h-[30px] items-center gap-1 rounded-full bg-white px-2.5 text-[10px] font-medium text-green-700 transition hover:bg-green-50 dark:bg-midnight-card dark:text-green-400 dark:hover:bg-green-500/10">
            <Circle className="h-2.5 w-2.5" /> Tamamla
          </button>
        </div>
      )}
    </div>
  );
}

function GoalDetailModal({ goal, onClose }: { goal: StudyGoal | null; onClose: () => void }) {
  return (
    <Modal isOpen={!!goal} onClose={onClose} title="Hedef Analizi" variant="center">
      {goal && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-cream-card p-4 dark:bg-white/5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
              {new Date(goal.createdAt).toLocaleDateString("tr-TR")} — {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString("tr-TR") : "devam ediyor"}
            </p>
            {goal.targetQuestions !== null && (
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-espresso dark:text-cream">Soru Hedefi</span>
                  <span className="text-espresso-muted dark:text-cream/40">{goal.progressQuestions} / {goal.targetQuestions}</span>
                </div>
                <ProgressBar value={pct(goal.progressQuestions, goal.targetQuestions)} />
              </div>
            )}
            {goal.targetMinutes !== null && (
              <div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-espresso dark:text-cream">Süre Hedefi</span>
                  <span className="text-espresso-muted dark:text-cream/40">{goal.progressMinutes} / {goal.targetMinutes} dk</span>
                </div>
                <ProgressBar value={pct(goal.progressMinutes, goal.targetMinutes)} />
              </div>
            )}
          </div>

          {goal.topicGoals.length > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Özel Konu/Görev Hedefleri
              </h3>
              <div className="space-y-2">
                {goal.topicGoals.map((topic) => (
                  <div key={topic.id} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-semibold text-espresso dark:text-cream">{topic.title}</p>
                      {topic.isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-espresso-muted/40 dark:text-cream/20" />
                      )}
                    </div>
                    <p className="mb-1 text-[10px] text-espresso-muted dark:text-cream/40"><GoalSummaryLine goal={{ ...topic } as unknown as StudyGoal} /></p>
                    {topic.description && <p className="text-[11px] italic text-espresso-muted dark:text-cream/50">&ldquo;{topic.description}&rdquo;</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function HistoryPreviewCard({ goal, onOpen }: { goal: StudyGoal; onOpen: () => void }) {
  const overallPct = Math.round(
    (pct(goal.progressQuestions, goal.targetQuestions) + pct(goal.progressMinutes, goal.targetMinutes)) /
      ((goal.targetQuestions ? 1 : 0) + (goal.targetMinutes ? 1 : 0) || 1)
  );
  return (
    <motion.button
      onClick={onOpen}
      whileHover={{ scale: 1.01 }}
      className="flex w-full items-center gap-3 rounded-2xl bg-cream-card p-3.5 text-left dark:bg-white/5"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-brand-600 dark:bg-midnight-card">
        %{overallPct}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-espresso dark:text-cream">
          {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString("tr-TR") : ""}
        </p>
        <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40"><GoalSummaryLine goal={goal} /></p>
      </div>
      {goal.topicGoals.length > 0 && (
        <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-espresso-muted dark:bg-midnight-card dark:text-cream/40">
          {goal.topicGoals.length} konu
        </span>
      )}
    </motion.button>
  );
}

export function PomodoroTab() {
  const { studentId } = useStudentScope();
  const { showError, showSuccess } = useToast();
  const [progress, setProgress] = useLocalStorageState<DailyProgress>("routinix-kampus-private-pomodoro", emptyProgress());
  const [mode, setMode] = useState<"work" | "break">("work");
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeGoal, setActiveGoal] = useState<StudyGoal | null>(null);
  const [history, setHistory] = useState<StudyGoal[]>([]);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [inspectingGoal, setInspectingGoal] = useState<StudyGoal | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (progress.day !== todayKey()) setProgress(emptyProgress());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGoals() {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/study-goals?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Hedefler yüklenemedi.");
      setActiveGoal(data.active);
      setHistory(data.history ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hedefler yüklenemedi.");
    } finally {
      setGoalsLoaded(true);
    }
  }

  useEffect(() => {
    loadGoals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function syncGoalProgress(delta: { addQuestions?: number; addMinutes?: number }) {
    if (!activeGoal) return;
    setActiveGoal((prev) =>
      prev ? { ...prev, progressQuestions: prev.progressQuestions + (delta.addQuestions ?? 0), progressMinutes: prev.progressMinutes + (delta.addMinutes ?? 0) } : prev
    );
    try {
      await fetch(`/api/study-goals/${activeGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(delta),
      });
    } catch {
      // sessiz — bir sonraki loadGoals() gerçek durumu düzeltir
    }
  }

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (mode === "work") {
            setProgress((prev) => ({ ...prev, focusSeconds: prev.focusSeconds + WORK_SECONDS, sessionsCompleted: prev.sessionsCompleted + 1 }));
            syncGoalProgress({ addMinutes: WORK_SECONDS / 60 });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, mode, setProgress, activeGoal?.id]);

  function resetTimer() {
    setIsRunning(false);
    setMode("work");
    setSecondsLeft(WORK_SECONDS);
  }

  function addQuestions(count: number) {
    setProgress((prev) => ({ ...prev, questionsDone: prev.questionsDone + count }));
    syncGoalProgress({ addQuestions: count });
  }

  async function addTopicGoal(data: { title: string; description: string; targetMinutes: string; targetQuestions: string }) {
    if (!activeGoal) return;
    try {
      const res = await fetch(`/api/study-goals/${activeGoal.id}/topics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          targetMinutes: data.targetMinutes || undefined,
          targetQuestions: data.targetQuestions || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error ?? "Eklenemedi.");
      setActiveGoal((prev) => (prev ? { ...prev, topicGoals: [...prev.topicGoals, result.topicGoal] } : prev));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Eklenemedi.");
    }
  }

  async function topicAddQuestions(topicId: string, n: number) {
    setActiveGoal((prev) =>
      prev ? { ...prev, topicGoals: prev.topicGoals.map((t) => (t.id === topicId ? { ...t, progressQuestions: t.progressQuestions + n } : t)) } : prev
    );
    try {
      await fetch(`/api/study-topic-goals/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addQuestions: n }),
      });
    } catch {
      // sessiz
    }
  }

  async function topicComplete(topicId: string) {
    setActiveGoal((prev) => (prev ? { ...prev, topicGoals: prev.topicGoals.map((t) => (t.id === topicId ? { ...t, isCompleted: true } : t)) } : prev));
    try {
      await fetch(`/api/study-topic-goals/${topicId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
    } catch {
      // sessiz
    }
  }

  async function finishActiveGoal() {
    if (!activeGoal) return;
    setFinishing(true);
    try {
      const res = await fetch(`/api/study-goals/${activeGoal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complete: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Hedef kapatılamadı.");
      showSuccess("Hedef tamamlandı, Geçmiş Hedeflerim'e taşındı.");
      setActiveGoal(null);
      setHistory((prev) => [data.goal, ...prev]);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hedef kapatılamadı.");
    } finally {
      setFinishing(false);
    }
  }

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-brand-50 px-4 py-3 text-xs font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-600/10 dark:text-brand-300">
        <Lock className="h-4 w-4 shrink-0" /> Bu veriler sadece sana özeldir, öğretmen/yönetici panellerine yansımaz.
      </div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-6 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
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

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Timer className="h-4 w-4 text-brand-600" /> Hedeflerim
          </h2>
          {activeGoal && (
            <button onClick={finishActiveGoal} disabled={finishing} className="flex items-center gap-1 rounded-full bg-cream-card px-2.5 py-1 text-[10px] font-medium text-espresso-muted transition hover:bg-green-50 hover:text-green-700 disabled:opacity-60 dark:bg-white/5 dark:text-cream/40 dark:hover:bg-green-500/10">
              {finishing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Hedefi Bitir
            </button>
          )}
        </div>

        {!goalsLoaded && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}

        {goalsLoaded && !activeGoal && (
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-cream-card py-8 text-center dark:bg-white/5">
            <Target className="h-8 w-8 text-brand-600" />
            <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz aktif bir hedefin yok.</p>
            <button
              onClick={() => setCreatingGoal(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-espresso px-5 text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" /> Hedef Belirle
            </button>
          </div>
        )}

        {activeGoal && (
          <div className="space-y-4">
            {activeGoal.targetQuestions !== null && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-espresso dark:text-cream"><BookOpenCheck className="h-3.5 w-3.5 text-brand-600" /> Soru Hedefi</span>
                  <span className="text-espresso-muted dark:text-cream/40">{activeGoal.progressQuestions} / {activeGoal.targetQuestions}</span>
                </div>
                <ProgressBar value={pct(activeGoal.progressQuestions, activeGoal.targetQuestions)} />
                <div className="mt-2 flex gap-1.5">
                  {[1, 5, 10].map((n) => (
                    <button key={n} onClick={() => addQuestions(n)} className="flex min-h-[32px] items-center gap-1 rounded-full bg-cream-card px-3 text-[11px] font-medium text-espresso transition hover:bg-brand-50 hover:text-brand-700 dark:bg-white/5 dark:text-cream dark:hover:bg-brand-600/15">
                      <Plus className="h-3 w-3" /> {n} Soru
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeGoal.targetMinutes !== null && (
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-espresso dark:text-cream"><Flame className="h-3.5 w-3.5 text-brand-600" /> Çalışma Süresi Hedefi</span>
                  <span className="text-espresso-muted dark:text-cream/40">{activeGoal.progressMinutes} dk / {activeGoal.targetMinutes} dk</span>
                </div>
                <ProgressBar value={pct(activeGoal.progressMinutes, activeGoal.targetMinutes)} />
              </div>
            )}

            {activeGoal.topicGoals.length > 0 && (
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Özel Konu/Görev Hedefleri
                </h3>
                <div className="space-y-2">
                  {activeGoal.topicGoals.map((topic) => (
                    <TopicGoalRow key={topic.id} topic={topic} onAddQuestions={(n) => topicAddQuestions(topic.id, n)} onComplete={() => topicComplete(topic.id)} />
                  ))}
                </div>
              </div>
            )}

            <TopicGoalAddForm onAdd={addTopicGoal} />
          </div>
        )}
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <History className="h-4 w-4 text-brand-600" /> Geçmiş Hedeflerim
        </h2>
        <div className="space-y-2">
          {history.map((goal) => (
            <HistoryPreviewCard key={goal.id} goal={goal} onOpen={() => setInspectingGoal(goal)} />
          ))}
          {goalsLoaded && history.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz tamamlanmış bir hedefin yok.</p>}
        </div>
      </motion.div>

      <GoalCreateModal isOpen={creatingGoal} onClose={() => setCreatingGoal(false)} onCreated={(goal) => setActiveGoal(goal)} />
      <GoalDetailModal goal={inspectingGoal} onClose={() => setInspectingGoal(null)} />
    </div>
  );
}
