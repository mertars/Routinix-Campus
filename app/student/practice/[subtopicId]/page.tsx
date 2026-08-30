"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ArrowLeft, KeyRound, Check, Loader2, Download, RotateCcw } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { cn } from "@/lib/utils";

type Question = { id: string; order: number; prompt: string };
type AnswerKeyItem = { id: string; order: number; prompt: string; correctAnswer: string; solution: string };
type Phase = "loading" | "solving" | "revealed" | "completed";

// Akademik Röntgen — Test 1 "Konu Bilgisi", KENDİ ayrı tam ekranında (Faz F
// — daha önce panel içindeydi, artık Test 2'nin kilitli sınavı gibi kendi
// sayfası var, ama BİLEREK kilitli DEĞİL — süre/sekme kısıtlaması yok,
// öğrenci istediği an geri dönebilir). Tamamen açık uçlu: şık YOK, tüm
// sorular tek seferde ekrana gelir, "Cevap Anahtarını Gör" ile çözümler
// açılır, öğrenci sonda TEK bir "Yapamadıklarım" listesinden işaretler.
export default function PracticeTestPage() {
  const params = useParams<{ subtopicId: string }>();
  const searchParams = useSearchParams();
  const subject = searchParams.get("subject") ?? "Matematik";
  const router = useRouter();
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [phase, setPhase] = useState<Phase>("loading");
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKeyItem[]>([]);
  const [notDone, setNotDone] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ total: number; correct: number; missedChecks: string[] } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    fetch("/api/xray/practice-attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, subject, subtopicId: params.subtopicId }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data?.error ?? "Test başlatılamadı.");
        setAttemptId(data.attemptId);
        setQuestions(data.questions);
        setPhase("solving");
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Test başlatılamadı.");
        router.push("/student");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, params.subtopicId]);

  async function revealAnswerKey() {
    if (!attemptId) return;
    try {
      const res = await fetch(`/api/xray/practice-attempt/${attemptId}/answer-key`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Cevap anahtarı yüklenemedi.");
      setAnswerKey(data.questions);
      setPhase("revealed");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Cevap anahtarı yüklenemedi.");
    }
  }

  function toggleNotDone(questionId: string) {
    setNotDone((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  async function finish() {
    if (!attemptId) return;
    try {
      const res = await fetch(`/api/xray/practice-attempt/${attemptId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notDoneQuestionIds: [...notDone] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Test bitirilemedi.");
      setSummary(data);
      setPhase("completed");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Test bitirilemedi.");
    }
  }

  async function downloadWorksheet() {
    if (!attemptId) return;
    setDownloading(true);
    try {
      await fetchAndDownloadPdf(`/api/xray/practice-worksheet?attemptId=${encodeURIComponent(attemptId)}`, undefined, `calisma-yapragi-${params.subtopicId}.pdf`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-cream/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-midnight/80">
        <button
          onClick={() => router.push("/student")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300">
          <BookOpen className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Konu Bilgisi Testi</span>
        </div>
        <button
          onClick={downloadWorksheet}
          disabled={downloading || !attemptId}
          aria-label="Çalışma yaprağını indir"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </button>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 py-20 text-sm text-espresso-muted dark:text-cream/40">
              <Loader2 className="h-5 w-5 animate-spin" /> Hazırlanıyor...
            </motion.div>
          )}

          {phase === "solving" && (
            <motion.div key="solving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {questions.map((q) => (
                <div key={q.id} className="rounded-2xl border border-sky-500/15 bg-white/70 p-4 shadow-sm dark:border-sky-400/10 dark:bg-midnight-card/50">
                  <div className="mb-2 flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{q.order}</span>
                    <p className="pt-0.5 text-sm font-medium leading-relaxed text-espresso dark:text-cream">{q.prompt}</p>
                  </div>
                  <textarea
                    placeholder="Çözümünü buraya yazabilirsin (sadece senin için, kaydedilmez)..."
                    rows={2}
                    className="ml-9 w-[calc(100%-2.25rem)] resize-none rounded-xl border border-hairline bg-cream-card/60 px-3 py-2 text-xs text-espresso outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-cream"
                  />
                </div>
              ))}
              <button
                onClick={revealAnswerKey}
                className="sticky bottom-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-500"
              >
                <KeyRound className="h-4 w-4" /> Cevap Anahtarını Gör
              </button>
            </motion.div>
          )}

          {phase === "revealed" && (
            <motion.div key="revealed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {answerKey.map((item) => (
                <div key={item.id} className="rounded-2xl border border-sky-500/15 bg-white/70 p-4 shadow-sm dark:border-sky-400/10 dark:bg-midnight-card/50">
                  <div className="mb-2 flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">{item.order}</span>
                    <p className="pt-0.5 text-sm font-medium leading-relaxed text-espresso dark:text-cream">{item.prompt}</p>
                  </div>
                  <div className="ml-9 space-y-1">
                    <p className="text-xs font-semibold text-sky-600 dark:text-sky-300">Cevap: {item.correctAnswer}</p>
                    <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/50">{item.solution}</p>
                  </div>
                </div>
              ))}

              <div className="rounded-2xl border border-amber-400/25 bg-amber-50 p-4 dark:border-amber-400/15 dark:bg-amber-500/10">
                <p className="mb-2 text-sm font-semibold text-amber-800 dark:text-amber-300">Yapamadıklarım</p>
                <p className="mb-3 text-[11px] text-amber-700/80 dark:text-amber-300/60">
                  Yukarıdaki cevap anahtarına bakarak çözemediğin soruları işaretle — işaretlemediklerin doğru yapmış sayılır.
                </p>
                <div className="space-y-1.5">
                  {answerKey.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleNotDone(item.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition",
                        notDone.has(item.id)
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                          : "bg-white text-espresso dark:bg-midnight-card dark:text-cream"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                          notDone.has(item.id) ? "border-rose-500 bg-rose-500" : "border-hairline dark:border-white/20"
                        )}
                      >
                        {notDone.has(item.id) && <Check className="h-3 w-3 text-white" />}
                      </span>
                      Soru {item.order}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={finish}
                className="sticky bottom-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 text-sm font-semibold text-white shadow-lg transition hover:bg-sky-500"
              >
                Testi Bitir
              </button>
            </motion.div>
          )}

          {phase === "completed" && summary && (
            <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-300">
                <span className="text-lg font-bold">
                  {summary.correct}/{summary.total}
                </span>
              </div>
              <h1 className="text-lg font-bold text-espresso dark:text-cream">Test tamamlandı</h1>
              {summary.missedChecks.length > 0 && (
                <div className="mx-auto max-w-md rounded-2xl bg-rose-50 p-4 text-left text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  <p className="mb-1.5 font-semibold">Eksik olabilecek beceriler:</p>
                  <ul className="list-disc space-y-1 pl-4">
                    {summary.missedChecks.map((check, index) => (
                      <li key={index}>{check}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => router.push("/student")}
                  className="flex min-h-[44px] items-center gap-2 rounded-2xl bg-sky-600 px-5 text-sm font-semibold text-white transition hover:bg-sky-500"
                >
                  <ArrowLeft className="h-4 w-4" /> Panele Dön
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-hairline px-5 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                >
                  <RotateCcw className="h-4 w-4" /> Tekrar Çöz
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
