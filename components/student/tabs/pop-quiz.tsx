"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, Timer, ChevronLeft, ChevronRight, PartyPopper, Zap, Loader2 } from "lucide-react";
import { INITIAL_BRANCHES } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useActiveQuiz, type ActiveQuiz } from "@/lib/use-active-quiz";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";

function useCountdown(launchedAtIso: string | undefined, durationSeconds: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  if (!launchedAtIso) return 0;
  const elapsed = Math.floor((now - new Date(launchedAtIso).getTime()) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

function QuizTakingModal({
  isOpen,
  onClose,
  quiz,
  onSubmitted,
}: {
  isOpen: boolean;
  onClose: () => void;
  quiz: ActiveQuiz | null;
  onSubmitted: () => void;
}) {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const secondsLeft = useCountdown(quiz?.launchedAt, quiz?.durationSeconds ?? 0);

  useEffect(() => {
    if (!isOpen) {
      setIndex(0);
      setAnswers({});
      setSubmitted(false);
    }
  }, [isOpen]);

  if (!quiz) return null;
  const question = quiz.questions[index];

  async function finish() {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quizzes/${quiz.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          answers: quiz.questions.map((q, i) => ({ questionId: q.id, value: answers[i] ?? "" })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yanıtlar gönderilemedi.");
      setSubmitted(true);
      onSubmitted();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yanıtlar gönderilemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={quiz.name}>
      {submitted ? (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-6 text-center">
          <PartyPopper className="mb-2 h-10 w-10 text-brand-600" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Yanıtların gönderildi!</p>
          <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">Sonuçların öğretmenine anlık olarak ulaştı.</p>
        </motion.div>
      ) : secondsLeft <= 0 ? (
        <p className="py-6 text-center text-sm text-espresso-muted dark:text-cream/40">Bu Pop-Quiz&apos;in süresi doldu.</p>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-espresso-muted dark:text-cream/40">Soru {index + 1}/{quiz.questions.length}</span>
            <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
              <Timer className="h-3 w-3" /> {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
            </span>
          </div>
          <div className="mb-3 flex h-40 items-center justify-center rounded-2xl bg-cream-card text-sm text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            🖼️ {question.imageLabel}
          </div>
          <input
            value={answers[index] ?? ""}
            onChange={(event) => setAnswers((prev) => ({ ...prev, [index]: event.target.value }))}
            placeholder="Cevabınızı yazın (örn. A veya 2√2)"
            className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="flex min-h-[44px] items-center gap-1 rounded-lg border border-hairline px-3 text-xs font-medium text-espresso disabled:opacity-40 dark:border-white/10 dark:text-cream"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Geri
            </button>
            {index < quiz.questions.length - 1 ? (
              <button
                onClick={() => setIndex((i) => Math.min(quiz.questions.length - 1, i + 1))}
                className="flex min-h-[44px] items-center gap-1 rounded-lg border border-hairline px-3 text-xs font-medium text-espresso dark:border-white/10 dark:text-cream"
              >
                İleri <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={submitting}
                className="flex min-h-[44px] items-center gap-1.5 rounded-lg bg-espresso px-4 text-xs font-semibold text-cream disabled:opacity-60 dark:bg-brand-600"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Sınavı Bitir
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function PopQuizTab() {
  const { studentId, branchName } = useStudentScope();
  const branchId = INITIAL_BRANCHES.find((b) => b.name === branchName)?.id ?? "";
  const { quiz: activeQuiz, alreadySubmitted, refetch } = useActiveQuiz(branchId, studentId);
  const [isOpen, setIsOpen] = useState(false);

  const secondsLeft = useCountdown(activeQuiz?.launchedAt, activeQuiz?.durationSeconds ?? 0);

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {activeQuiz && secondsLeft > 0 && !alreadySubmitted ? (
          <motion.button
            key="live"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setIsOpen(true)}
            className="flex w-full flex-col items-center gap-2 rounded-3xl border border-brand-500/40 bg-brand-600 p-6 text-center text-white shadow-lg"
          >
            <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1, repeat: Infinity }}>
              <Zap className="h-8 w-8" />
            </motion.span>
            <p className="text-sm font-semibold uppercase tracking-wide">Yeni Pop-Quiz!</p>
            <p className="text-lg font-bold">{activeQuiz.name}</p>
            <p className="text-xs text-white/80">Öğretmeniniz şu an canlı bir soru fırlattı — hemen katılın!</p>
          </motion.button>
        ) : activeQuiz && alreadySubmitted ? (
          <motion.div key="submitted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 rounded-3xl border border-hairline bg-white/70 p-6 text-center dark:border-white/10 dark:bg-midnight-card/70">
            <PartyPopper className="h-8 w-8 text-brand-600" />
            <p className="text-sm font-semibold text-espresso dark:text-cream">Yanıtların gönderildi, sonucun bekleniyor.</p>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-2 rounded-3xl border border-hairline bg-white/70 p-8 text-center dark:border-white/10 dark:bg-midnight-card/70">
            <Rocket className="h-8 w-8 text-espresso-muted dark:text-cream/30" />
            <p className="text-sm font-medium text-espresso dark:text-cream">Şu anda aktif bir Pop-Quiz yok</p>
            <p className="text-xs text-espresso-muted dark:text-cream/40">Öğretmenin bir soru fırlattığında bu ekranda anında görünecek.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <QuizTakingModal isOpen={isOpen} onClose={() => setIsOpen(false)} quiz={activeQuiz} onSubmitted={() => { refetch(); setTimeout(() => setIsOpen(false), 1500); }} />
    </div>
  );
}
