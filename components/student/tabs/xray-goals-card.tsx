"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Plus, PartyPopper, Loader2 } from "lucide-react";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Goal = {
  id: string;
  subject: string;
  subtopicId: string;
  subtopicName: string;
  targetScore: number;
  currentScore: number | null;
  createdByRole: string;
  achievedAt: string | null;
};
type Topic = { subtopicId: string; subtopicName: string };

const CREATED_BY_LABEL: Record<string, string> = { STUDENT: "Kendi hedefin", TEACHER: "Öğretmenin koydu", ADMIN: "Yönetici koydu" };

function NewGoalForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [subtopicId, setSubtopicId] = useState("");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [targetScore, setTargetScore] = useState(80);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.topics ?? []);
        setSubtopicId((current) => current || data.topics?.[0]?.subtopicId || "");
      })
      .catch(() => {});
  }, [subject]);

  async function submit() {
    if (!subtopicId || !studentId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/xray/mastery-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subtopicId, targetScore }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Hedef eklenemedi.");
      onCreated();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hedef eklenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
      <div className="mb-2.5 flex flex-wrap gap-2">
        <select
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {XRAY_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={subtopicId}
          onChange={(event) => setSubtopicId(event.target.value)}
          disabled={topics.length === 0}
          className="min-w-[140px] flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {topics.length === 0 && <option value="">Önce bir test çöz</option>}
          {topics.map((t) => (
            <option key={t.subtopicId} value={t.subtopicId}>
              {t.subtopicName}
            </option>
          ))}
        </select>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={targetScore}
          onChange={(event) => setTargetScore(Number(event.target.value))}
          className="flex-1 accent-brand-600"
        />
        <span className="w-12 shrink-0 text-right text-sm font-bold text-espresso dark:text-cream">%{targetScore}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-medium text-espresso-muted hover:bg-white dark:text-cream/50 dark:hover:bg-white/10">
          Vazgeç
        </button>
        <button
          onClick={submit}
          disabled={saving || !subtopicId}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Hedefi Kaydet
        </button>
      </div>
    </div>
  );
}

// Faz P — Pomodoro'nun "kalıcı hedef kartları" desenini Akademik
// Röntgen'e uyarlar: "Bu ay integral konusunu %80'e çıkar" gibi bir
// mastery skoru hedefi. Öğrenci kendi koyar, öğretmen/yönetici de
// koyabilir (bkz. mastery-goals route'undaki yetki kuralı).
export function XrayGoalsCard() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [adding, setAdding] = useState(false);

  function refresh() {
    if (!studentId) return;
    fetch(`/api/xray/mastery-goals?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setGoals(data.goals ?? []))
      .catch(() => showError("Hedefler yüklenemedi."));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(refresh, [studentId]);

  if (!goals) return null;
  const active = goals.filter((g) => !g.achievedAt);
  const achieved = goals.filter((g) => g.achievedAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-brand-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-brand-500/15 dark:bg-midnight-card/50"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Target className="h-4 w-4 text-brand-600" /> Hedeflerim
        </h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1 rounded-full bg-brand-500/10 px-2.5 py-1 text-[11px] font-semibold text-brand-700 dark:text-brand-300">
            <Plus className="h-3 w-3" /> Hedef Ekle
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {adding && (
          <motion.div key="form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
            <NewGoalForm
              onCancel={() => setAdding(false)}
              onCreated={() => {
                setAdding(false);
                refresh();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {active.length === 0 && achieved.length === 0 && !adding && (
        <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz bir hedefin yok — bir konu seç, bu ay nereye çıkarmak istediğini belirle.</p>
      )}

      <div className="space-y-2.5">
        {active.map((g) => {
          const progress = g.currentScore ?? 0;
          const pct = Math.min(100, Math.round((progress / g.targetScore) * 100));
          return (
            <div key={g.id} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-espresso dark:text-cream">{g.subtopicName}</span>
                <span className="text-espresso-muted dark:text-cream/40">
                  %{progress} / %{g.targetScore}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                <motion.div className="h-full rounded-full bg-brand-600" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 70, damping: 15 }} />
              </div>
              <p className="mt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">{CREATED_BY_LABEL[g.createdByRole] ?? g.createdByRole}</p>
            </div>
          );
        })}

        {achieved.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {achieved.map((g) => (
              <div key={g.id} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <PartyPopper className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {g.subtopicName} — %{g.targetScore} hedefine ulaştın!
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
