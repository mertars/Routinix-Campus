"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket,
  Plus,
  X,
  ImagePlus,
  Timer,
  MinusCircle,
  PlusCircle,
  Send,
  Eye,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type PrepQuestion = { id: string; imageLabel: string; answer: string };
type Stage = "prep" | "live" | "done";
type LiveResult = { studentName: string; correct: number; wrong: number };
type BankQuestion = { id: string; imageLabel: string; answer: string };
type QuizDetail = {
  id: string;
  name: string;
  branchId: string;
  durationSeconds: number;
  launchedAt: string;
  submissions: { correct: number; wrong: number; student: { firstName: string; lastName: string } }[];
};

function StudentPreviewModal({ isOpen, onClose, questions }: { isOpen: boolean; onClose: () => void; questions: PrepQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(300);

  useEffect(() => {
    if (!isOpen || finished) return;
    const timer = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [isOpen, finished]);

  if (questions.length === 0) return null;
  const question = questions[index];

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); setFinished(false); setIndex(0); }} title="Öğrenci Arayüzü Simülasyonu">
      {!finished ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-espresso-muted dark:text-cream/40">Soru {index + 1}/{questions.length}</span>
            <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white">
              <Timer className="h-3 w-3" /> {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
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
            {index < questions.length - 1 ? (
              <button
                onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
                className="flex min-h-[44px] items-center gap-1 rounded-lg border border-hairline px-3 text-xs font-medium text-espresso dark:border-white/10 dark:text-cream"
              >
                İleri <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : null}
            <button
              onClick={() => setFinished(true)}
              className="min-h-[44px] rounded-lg bg-espresso px-4 text-xs font-semibold text-cream dark:bg-brand-600"
            >
              Sınavı Bitir
            </button>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-6 text-center">
          <PartyPopper className="mb-2 h-10 w-10 text-brand-600" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Bravo! Test Gönderildi</p>
          <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">Bu, öğrencinin göreceği ekranın önizlemesidir.</p>
        </motion.div>
      )}
    </Modal>
  );
}

export function PopQuizTab() {
  const { staffRecord, assignedBranches } = useTeacherScope();
  const { showError, showSuccess } = useToast();
  const [myBank, setMyBank] = useState<BankQuestion[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("prep");
  const [quizName, setQuizName] = useState("");
  const [questions, setQuestions] = useState<PrepQuestion[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [ending, setEnding] = useState(false);

  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [durationMinutes, setDurationMinutes] = useState(10);

  const [currentQuiz, setCurrentQuiz] = useState<QuizDetail | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (assignedBranches.length > 0 && !branchId) setBranchId(assignedBranches[0].id);
  }, [assignedBranches, branchId]);

  const branch = assignedBranches.find((b) => b.id === branchId);
  const canLaunch = quizName.trim().length > 0 && questions.length >= 5 && questions.every((q) => q.answer.trim());

  useEffect(() => {
    fetch(`/api/quizzes/bank?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyBank(data.questions ?? []))
      .catch(() => {
        // sessiz — banka boş görünür
      });
  }, [staffRecord.id]);

  function addQuestionPhoto(file: File) {
    setQuestions((prev) => [...prev, { id: crypto.randomUUID(), imageLabel: file.name, answer: "" }]);
  }

  function addFromBank(imageLabel: string, answer: string) {
    setQuestions((prev) => (prev.some((q) => q.imageLabel === imageLabel) ? prev : [...prev, { id: crypto.randomUUID(), imageLabel, answer }]));
  }

  function updateAnswer(id: string, answer: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, answer } : q)));
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function launchQuiz() {
    if (!branch) return;
    setLaunching(true);
    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: staffRecord.id,
          branchId: branch.id,
          name: quizName,
          durationSeconds: durationMinutes * 60,
          questions: questions.map((q) => ({ imageLabel: q.imageLabel, answer: q.answer })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Quiz fırlatılamadı.");
      setCurrentQuiz({ ...data.quiz, submissions: [] });
      setSecondsLeft(durationMinutes * 60);
      setStage("live");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Quiz fırlatılamadı.");
    } finally {
      setLaunching(false);
    }
  }

  // Canlı aşamada quiz detayını (yanıtları) periyodik olarak tazele.
  useEffect(() => {
    if (stage !== "live" || !currentQuiz) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/quizzes/${currentQuiz.id}`);
        const data = await res.json();
        if (res.ok) setCurrentQuiz(data.quiz);
      } catch {
        // sessiz — bir sonraki tur tekrar dener
      }
    }, 2500);
    return () => clearInterval(interval);
    // currentQuiz bilerek deps'te değil — her poll'da yeni referans üretiyor,
    // sadece id değişince (stage geçişinde) interval'ın yeniden kurulmasını istiyoruz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentQuiz?.id]);

  useEffect(() => {
    if (stage !== "live") return;
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [stage, secondsLeft]);

  function adjustTime(deltaMinutes: number) {
    setSecondsLeft((s) => Math.max(0, s + deltaMinutes * 60));
  }

  async function endQuiz() {
    if (!currentQuiz) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/quizzes/${currentQuiz.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: "ENDED" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "Quiz sonlandırılamadı.");
      }
      showSuccess("Sonuçlar yönetici paneline iletildi.");
      setStage("done");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Quiz sonlandırılamadı.");
    } finally {
      setEnding(false);
    }
  }

  function resetAll() {
    setStage("prep");
    setQuizName("");
    setQuestions([]);
    setCurrentQuiz(null);
    fetch(`/api/quizzes/bank?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyBank(data.questions ?? []))
      .catch(() => {});
  }

  const liveResults: LiveResult[] = (currentQuiz?.submissions ?? []).map((s) => ({
    studentName: `${s.student.firstName} ${s.student.lastName}`,
    correct: s.correct,
    wrong: s.wrong,
  }));

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Rocket className="h-4 w-4 text-brand-600" /> Canlı Pop-Quiz Fırlatıcı
          </h2>
          {questions.length >= 1 && stage === "prep" && (
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <Eye className="h-3.5 w-3.5" /> Öğrenci Önizlemesini Aç
            </button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {stage === "prep" && (
            <motion.div key="prep" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <input
                value={quizName}
                onChange={(event) => setQuizName(event.target.value)}
                placeholder="Pop-Quiz Adı (örn. Türev Hız Testi)"
                className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <p className="mb-2 text-[11px] font-medium text-espresso-muted dark:text-cream/40">
                Soru Fotoğrafları (en az 5) — {questions.length}/5+
              </p>
              <div className="mb-3 space-y-2">
                {questions.map((q, index) => (
                  <div key={q.id} className="flex items-center gap-2 rounded-xl bg-cream-card px-3 py-2 dark:bg-white/5">
                    <span className="text-xs font-semibold text-espresso-muted dark:text-cream/40">{index + 1}.</span>
                    <span className="flex-1 truncate text-xs text-espresso dark:text-cream">{q.imageLabel}</span>
                    <input
                      value={q.answer}
                      onChange={(event) => updateAnswer(q.id, event.target.value)}
                      placeholder="Cevap (A veya 2√2)"
                      className="w-32 rounded-lg border border-hairline bg-white px-2 py-1 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    />
                    <button onClick={() => removeQuestion(q.id)} className="text-espresso-muted hover:text-rose-600 dark:text-cream/40">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => fileInput.current?.click()}
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hairline py-3 text-xs font-medium text-espresso-muted transition hover:border-brand-600/40 hover:text-brand-600 dark:border-white/10 dark:text-cream/40"
              >
                <ImagePlus className="h-4 w-4" /> Soru Fotoğrafı Ekle
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) addQuestionPhoto(file);
                }}
              />

              {myBank.length > 0 && (
                <div className="mb-4 rounded-xl border border-hairline p-2.5 dark:border-white/10">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                    Soru Bankasından Ekle
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {myBank.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addFromBank(item.imageLabel, item.answer)}
                        className="rounded-full bg-cream-card px-2.5 py-1 text-[11px] font-medium text-espresso transition hover:bg-brand-50 hover:text-brand-700 dark:bg-white/5 dark:text-cream dark:hover:bg-brand-600/15"
                      >
                        {item.imageLabel}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value)}
                  className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  {assignedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 dark:border-white/10">
                  <Timer className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Math.max(1, Number(event.target.value)))}
                    className="w-full bg-transparent text-sm text-espresso outline-none dark:text-cream"
                  />
                  <span className="shrink-0 text-xs text-espresso-muted dark:text-cream/40">dk</span>
                </div>
              </div>

              <button
                onClick={launchQuiz}
                disabled={!canLaunch || launching}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-3.5 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {launching ? "Fırlatılıyor..." : `${branch?.name ?? ""} Sınıfına Quiz'i Fırlat`}
              </button>
            </motion.div>
          )}

          {stage === "live" && (
            <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl bg-cream-card p-5 dark:bg-white/5">
                <motion.p animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-3xl font-bold text-brand-600">
                  {String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:{String(secondsLeft % 60).padStart(2, "0")}
                </motion.p>
                <div className="flex items-center gap-2">
                  <button onClick={() => adjustTime(-1)} className="flex min-h-[44px] items-center gap-1 rounded-full bg-white px-4 text-xs font-medium text-espresso shadow-sm active:scale-[0.96] dark:bg-midnight-card dark:text-cream">
                    <MinusCircle className="h-3.5 w-3.5" /> 1 Dk
                  </button>
                  <button onClick={() => adjustTime(1)} className="flex min-h-[44px] items-center gap-1 rounded-full bg-white px-4 text-xs font-medium text-espresso shadow-sm active:scale-[0.96] dark:bg-midnight-card dark:text-cream">
                    <PlusCircle className="h-3.5 w-3.5" /> 1 Dk
                  </button>
                </div>
              </div>

              <h3 className="mb-2 text-xs font-semibold text-espresso dark:text-cream">Canlı Sonuç Matrisi</h3>
              <div className="mb-4 space-y-1.5">
                <AnimatePresence>
                  {liveResults.map((result) => (
                    <motion.div
                      key={result.studentName}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2 text-xs dark:bg-white/5"
                    >
                      <span className="font-medium text-espresso dark:text-cream">{result.studentName}</span>
                      <span className="text-espresso-muted dark:text-cream/40">
                        <span className="text-green-600 dark:text-green-400">{result.correct}D</span> ·{" "}
                        <span className="text-rose-600 dark:text-rose-400">{result.wrong}Y</span>
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {liveResults.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Öğrenciler henüz yanıt göndermedi...</p>}
              </div>

              <button
                onClick={endQuiz}
                disabled={ending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-3 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {ending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {ending ? "Gönderiliyor..." : "Sonuçları Yöneticiye Gönder"}
              </button>
            </motion.div>
          )}

          {stage === "done" && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="mb-2 h-10 w-10 text-green-600" />
              <p className="text-sm font-semibold text-espresso dark:text-cream">Sonuçlar yönetici panelindeki öğrenci karnesine işlendi.</p>
              <button onClick={resetAll} className="mt-4 flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-espresso dark:border-white/10 dark:text-cream">
                <Plus className="h-3.5 w-3.5" /> Yeni Quiz Hazırla
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <StudentPreviewModal isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} questions={questions} />
    </div>
  );
}
