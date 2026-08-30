"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Check, X, Loader2, KeyRound, ThumbsUp, ThumbsDown, RotateCcw, Download } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { cn } from "@/lib/utils";

const SUBJECT = "Matematik"; // Faz B: soru havuzu şu an sadece bu dersi kapsıyor

type Topic = { subtopicId: string; name: string; questionCount: number };
type Question = { id: string; format: "OPEN_ENDED" | "MULTIPLE_CHOICE"; difficulty: number; prompt: string; options: string[] };
type AnswerKeyItem = { id: string; format: "OPEN_ENDED" | "MULTIPLE_CHOICE"; prompt: string; correctAnswer: string; solution: string; alreadyAnswered: boolean; wasCorrect: boolean | null };
type Phase = "loading-topics" | "select-topic" | "solving" | "revealed" | "completed";

// Akademik Röntgen — Test 1 "Konu Bilgisi": Test 2'nin (kilitli, atamalı)
// aksine öğrenci istediği zaman serbestçe açar, süre/kilit yok — bir soru
// bankası/çalışma yaprağı gibi. Çoktan seçmeliler anında derecelenir; açık
// uçlular "Cevap Anahtarına Ulaş" ile sonda açılıp öğrenci kendi işaretler
// (bkz. kullanıcı kararı — karışık model).
export function XrayPracticeTest() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [phase, setPhase] = useState<Phase>("loading-topics");
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mcqResults, setMcqResults] = useState<Record<string, { isCorrect: boolean; correctAnswer: string; solution: string }>>({});
  const [answerKey, setAnswerKey] = useState<AnswerKeyItem[]>([]);
  const [selfReports, setSelfReports] = useState<Record<string, boolean>>({});
  const [summary, setSummary] = useState<{ total: number; correct: number; missedChecks: string[] } | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/xray/practice-topics?subject=${encodeURIComponent(SUBJECT)}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.subtopics ?? []);
        setPhase("select-topic");
      })
      .catch(() => showError("Konu listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startTopic(topic: Topic) {
    if (!studentId) return;
    setSelectedTopic(topic);
    setMcqResults({});
    setSelfReports({});
    setSummary(null);
    try {
      const res = await fetch("/api/xray/practice-attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject: SUBJECT, subtopicId: topic.subtopicId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Test başlatılamadı.");
      setAttemptId(data.attemptId);
      setQuestions(data.questions);
      setPhase("solving");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Test başlatılamadı.");
    }
  }

  async function answerMcq(question: Question, option: string) {
    if (!attemptId || mcqResults[question.id]) return;
    try {
      const res = await fetch(`/api/xray/practice-attempt/${attemptId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedAnswer: option }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Cevap gönderilemedi.");
      setMcqResults((prev) => ({ ...prev, [question.id]: { isCorrect: data.isCorrect, correctAnswer: data.correctAnswer, solution: data.solution } }));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Cevap gönderilemedi.");
    }
  }

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

  async function selfReport(questionId: string, wasCorrect: boolean) {
    if (!attemptId) return;
    setSelfReports((prev) => ({ ...prev, [questionId]: wasCorrect }));
    try {
      await fetch(`/api/xray/practice-attempt/${attemptId}/self-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, wasCorrect }),
      });
    } catch {
      showError("İşaretleme kaydedilemedi.");
    }
  }

  async function finish() {
    if (!attemptId) return;
    try {
      const res = await fetch(`/api/xray/practice-attempt/${attemptId}/complete`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Test bitirilemedi.");
      setSummary(data);
      setPhase("completed");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Test bitirilemedi.");
    }
  }

  async function downloadWorksheet(topic: Topic) {
    setDownloading(true);
    try {
      await fetchAndDownloadPdf(
        `/api/xray/practice-worksheet?subject=${encodeURIComponent(SUBJECT)}&subtopicId=${encodeURIComponent(topic.subtopicId)}`,
        undefined,
        `${topic.name}-calisma-yapragi.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }

  // Bir sorunun (henüz) yanıt bekleyip beklemediğini belirler — "revealed"
  // fazında sadece bunlar için Yaptım/Yapamadım butonu gösterilir (MCQ'da
  // sistem zaten biliyor).
  function needsSelfReport(item: AnswerKeyItem): boolean {
    return !item.alreadyAnswered || item.format === "OPEN_ENDED";
  }

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Konu Bilgisi Testi — Soru Bankası
      </h2>

      <AnimatePresence mode="wait">
        {phase === "loading-topics" && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 py-4 text-xs text-espresso-muted dark:text-cream/40">
            <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
          </motion.div>
        )}

        {phase === "select-topic" && (
          <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {topics.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz bu ders için soru bankası hazır değil.</p>}
            {topics.map((topic) => (
              <div key={topic.subtopicId} className="flex items-center gap-2">
                <button
                  onClick={() => startTopic(topic)}
                  className="flex min-h-[48px] flex-1 items-center justify-between rounded-2xl bg-cream-card px-4 text-left text-sm font-medium text-espresso transition hover:bg-sky-500/10 dark:bg-white/5 dark:text-cream"
                >
                  {topic.name}
                  <span className="text-xs font-normal text-espresso-muted dark:text-cream/40">{topic.questionCount} soru</span>
                </button>
                <button
                  onClick={() => downloadWorksheet(topic)}
                  disabled={downloading}
                  aria-label="Çalışma yaprağını indir"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-500/25 bg-sky-500/10 text-sky-600 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {phase === "solving" && selectedTopic && (
          <motion.div key="solving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-xs font-semibold text-espresso-muted dark:text-cream/40">{selectedTopic.name}</p>
            {questions.map((q, index) => {
              const result = mcqResults[q.id];
              return (
                <div key={q.id} className="rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-espresso-muted dark:text-cream/40">
                    <span>Soru {index + 1}</span>
                    <span className="rounded-full bg-sky-500/10 px-2 py-0.5 font-semibold text-sky-600 dark:text-sky-300">Zorluk {q.difficulty}/5</span>
                  </div>
                  <p className="mb-2 text-sm font-medium text-espresso dark:text-cream">{q.prompt}</p>
                  {q.format === "MULTIPLE_CHOICE" ? (
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {q.options.map((option) => {
                        const isPicked = result && option === result.correctAnswer;
                        return (
                          <button
                            key={option}
                            disabled={!!result}
                            onClick={() => answerMcq(q, option)}
                            className={cn(
                              "flex min-h-[40px] items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-medium transition",
                              result && isPicked && "border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
                              result && !isPicked && "border-hairline bg-white text-espresso-muted dark:border-white/10 dark:bg-midnight-card dark:text-cream/40",
                              !result && "border-hairline bg-white text-espresso hover:border-sky-400 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
                            )}
                          >
                            {option}
                            {result && isPicked && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-espresso-muted dark:text-cream/40">Bu soruyu kağıda çöz — cevap anahtarında kontrol edeceksin.</p>
                  )}
                  {result && (
                    <p className={cn("mt-2 text-[11px] font-medium", result.isCorrect ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400")}>
                      {result.isCorrect ? "Doğru!" : `Yanlış — doğru cevap: ${result.correctAnswer}`}
                    </p>
                  )}
                </div>
              );
            })}
            <button
              onClick={revealAnswerKey}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              <KeyRound className="h-4 w-4" /> Cevap Anahtarına Ulaş
            </button>
          </motion.div>
        )}

        {phase === "revealed" && (
          <motion.div key="revealed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {answerKey.map((item, index) => {
              const reported = selfReports[item.id];
              const settled = item.alreadyAnswered ? item.wasCorrect : reported;
              return (
                <div key={item.id} className="rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
                  <p className="mb-1 text-[10px] font-semibold text-espresso-muted dark:text-cream/40">Soru {index + 1}</p>
                  <p className="mb-1.5 text-sm font-medium text-espresso dark:text-cream">{item.prompt}</p>
                  <p className="mb-1 text-xs font-semibold text-sky-600 dark:text-sky-300">Cevap: {item.correctAnswer}</p>
                  <p className="mb-2 text-[11px] text-espresso-muted dark:text-cream/50">{item.solution}</p>
                  {needsSelfReport(item) ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => selfReport(item.id, true)}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                          reported === true ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
                        )}
                      >
                        <ThumbsUp className="h-3 w-3" /> Yaptım
                      </button>
                      <button
                        onClick={() => selfReport(item.id, false)}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition",
                          reported === false ? "border-rose-500 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
                        )}
                      >
                        <ThumbsDown className="h-3 w-3" /> Yapamadım
                      </button>
                    </div>
                  ) : (
                    <p className={cn("text-[11px] font-medium", settled ? "text-green-600 dark:text-green-400" : "text-rose-600 dark:text-rose-400")}>
                      {settled ? <Check className="mr-1 inline h-3 w-3" /> : <X className="mr-1 inline h-3 w-3" />}
                      {settled ? "Doğru yapmışsın" : "Yanlış yapmışsın"}
                    </p>
                  )}
                </div>
              );
            })}
            <button
              onClick={finish}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              Testi Bitir
            </button>
          </motion.div>
        )}

        {phase === "completed" && summary && (
          <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-sky-500/10 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                {summary.correct}/{summary.total}
              </div>
              <p className="text-sm font-semibold text-espresso dark:text-cream">Test tamamlandı</p>
            </div>
            {summary.missedChecks.length > 0 && (
              <div className="rounded-2xl bg-rose-50 p-3.5 text-xs text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <p className="mb-1.5 font-semibold">Eksik olabilecek beceriler:</p>
                <ul className="list-disc space-y-1 pl-4">
                  {summary.missedChecks.map((check, index) => (
                    <li key={index}>{check}</li>
                  ))}
                </ul>
              </div>
            )}
            <button
              onClick={() => {
                setPhase("select-topic");
                setSelectedTopic(null);
                setAttemptId(null);
              }}
              className="flex min-h-[40px] items-center gap-2 rounded-lg border border-hairline px-4 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Başka Konu Çalış
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
