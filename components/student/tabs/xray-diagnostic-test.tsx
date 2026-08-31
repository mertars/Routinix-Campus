"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, Check, X, Loader2, Sparkles, RotateCcw } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { MathText } from "@/components/ui/math-text";
import { cn } from "@/lib/utils";

type Question = { id: string; subtopicId: string; difficulty: number; prompt: string; options: string[] };
type SubtopicResult = { subtopicId: string; masteryScore: number | null };
type Phase = "idle" | "loading" | "question" | "feedback" | "completed";

const SUBJECT = "Matematik"; // Faz 2: soru havuzu şu an sadece bu dersi kapsıyor (bkz. prisma/seed-xray-questions.ts)

// Akademik Röntgen — "Matematik Röntgeni" ürününün araştırılan gerçek
// mekaniğini uygulayan öğrenci tarafı test akışı: kolay soruyu çözersen o
// konuda zorlaşan sorular gelir, yanlış cevaplarsan o konuda test biter.
// Soru havuzunun (XrayQuestion) içeriği şu an placeholder — bkz. o dosyanın
// yorumu — ama bu bileşen HANGİ kaynaktan geldiğine bakmaz, sadece
// next-question/answer sözleşmesine göre çalışır.
export function XrayDiagnosticTest() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [results, setResults] = useState<SubtopicResult[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);

  async function fetchNextQuestion(currentSessionId: string) {
    setPhase("loading");
    try {
      const res = await fetch(`/api/xray/test-session/${currentSessionId}/next-question`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Soru getirilemedi.");
      if (data.completed) {
        setResults(data.results ?? []);
        setPhase("completed");
        return;
      }
      setQuestion(data.question);
      setSelected(null);
      setPhase("question");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Soru getirilemedi.");
      setPhase("idle");
    }
  }

  async function startTest() {
    if (!studentId) return;
    setPhase("loading");
    setResults([]);
    setAnsweredCount(0);
    try {
      const res = await fetch("/api/xray/test-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject: SUBJECT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Test başlatılamadı.");
      setSessionId(data.sessionId);
      await fetchNextQuestion(data.sessionId);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Test başlatılamadı.");
      setPhase("idle");
    }
  }

  async function submitAnswer(option: string) {
    if (!sessionId || !question || phase !== "question") return;
    setSelected(option);
    setPhase("feedback");
    try {
      const res = await fetch(`/api/xray/test-session/${sessionId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedAnswer: option }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Cevap gönderilemedi.");
      setWasCorrect(data.isCorrect);
      setAnsweredCount((c) => c + 1);
      setTimeout(() => fetchNextQuestion(sessionId), 900);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Cevap gönderilemedi.");
      setPhase("question");
    }
  }

  const testedCount = results.filter((r) => r.masteryScore !== null).length;
  const averageScore = testedCount === 0 ? 0 : Math.round(results.reduce((sum, r) => sum + (r.masteryScore ?? 0), 0) / testedCount);

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Scan className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Matematik Röntgeni — Konu Bazlı Tanı Testi
      </h2>

      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <p className="text-xs text-espresso-muted dark:text-cream/40">
              Kolay bir soruyla başlar; doğru cevapladıkça o konuda zorlaşan sorular gelir, yanlış cevapladığın konuda test durur. Sonunda
              konu bazlı gerçek bir röntgen raporu çıkar.
            </p>
            <button
              onClick={startTest}
              className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              <Sparkles className="h-4 w-4" /> Röntgen Testine Başla
            </button>
          </motion.div>
        )}

        {phase === "loading" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 py-6 text-xs text-espresso-muted dark:text-cream/40">
            <Loader2 className="h-4 w-4 animate-spin" /> Hazırlanıyor...
          </motion.div>
        )}

        {(phase === "question" || phase === "feedback") && question && (
          <motion.div key={question.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} className="space-y-3">
            <div className="flex items-center justify-between text-[10px] text-espresso-muted dark:text-cream/40">
              <span>Soru {answeredCount + 1}</span>
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-600 dark:text-sky-300">Zorluk {question.difficulty}/5</span>
            </div>
            <MathText text={question.prompt} className="text-sm font-medium text-espresso dark:text-cream" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const isSelected = selected === option;
                const showFeedback = phase === "feedback" && isSelected;
                return (
                  <button
                    key={option}
                    disabled={phase === "feedback"}
                    onClick={() => submitAnswer(option)}
                    className={cn(
                      "flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm font-medium transition",
                      showFeedback && wasCorrect && "border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
                      showFeedback && !wasCorrect && "border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
                      !showFeedback && "border-hairline bg-cream-card text-espresso hover:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-cream"
                    )}
                  >
                    <MathText text={option} />
                    {showFeedback && (wasCorrect ? <Check className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />)}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {phase === "completed" && (
          <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-sky-500/10 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-lg font-bold text-white">%{averageScore}</div>
              <div>
                <p className="text-sm font-semibold text-espresso dark:text-cream">Röntgen tamamlandı</p>
                <p className="text-xs text-espresso-muted dark:text-cream/40">{testedCount} konu test edildi</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {results
                .filter((r) => r.masteryScore !== null)
                .map((r) => (
                  <div key={r.subtopicId}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-espresso-muted dark:text-cream/40">{r.subtopicId}</span>
                      <span className="font-semibold text-espresso dark:text-cream">%{r.masteryScore}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                      <motion.div
                        className={cn("h-full rounded-full", (r.masteryScore ?? 0) >= 60 ? "bg-emerald-500" : (r.masteryScore ?? 0) >= 30 ? "bg-amber-500" : "bg-rose-500")}
                        initial={{ width: 0 }}
                        animate={{ width: `${r.masteryScore}%` }}
                        transition={{ type: "spring", stiffness: 70, damping: 15 }}
                      />
                    </div>
                  </div>
                ))}
            </div>

            <button
              onClick={startTest}
              className="flex min-h-[40px] items-center gap-2 rounded-lg border border-hairline px-4 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Tekrar Test Ol
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
