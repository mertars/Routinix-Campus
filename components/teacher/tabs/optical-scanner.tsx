"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, ScanLine, CheckCircle2, KeyRound, X, Maximize2 } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type Stage = "idle" | "scanning" | "done";
type Exam = { id: string; name: string };
type RosterStudent = { id: string; firstName: string; lastName: string; branchId: string };
type ScannedSheet = { id: string; studentName: string; branchName: string; correct: number; total: number; scannedAt: string };

function AnswerKeyModal({
  isOpen,
  onClose,
  answers,
  setAnswers,
}: {
  isOpen: boolean;
  onClose: () => void;
  answers: string[];
  setAnswers: (next: string[]) => void;
}) {
  const [count, setCount] = useState(answers.length || 10);

  function resize(nextCount: number) {
    setCount(nextCount);
    const next = [...answers];
    while (next.length < nextCount) next.push("A");
    setAnswers(next.slice(0, nextCount));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cevap Anahtarı Yükle / Düzenle">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-espresso-muted dark:text-cream/40">Soru Sayısı</span>
        <input
          type="number"
          value={count}
          onChange={(event) => resize(Math.max(1, Number(event.target.value)))}
          className="w-20 rounded-lg border border-hairline bg-white px-2 py-1 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>
      <div className="grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
        {answers.map((answer, index) => (
          <div key={index} className="flex items-center gap-1.5 rounded-lg bg-cream-card px-2 py-1.5 dark:bg-white/5">
            <span className="text-[11px] font-medium text-espresso-muted dark:text-cream/40">{index + 1}.</span>
            <input
              value={answer}
              onChange={(event) => {
                const next = [...answers];
                next[index] = event.target.value;
                setAnswers(next);
              }}
              className="w-full bg-transparent text-xs font-semibold text-espresso outline-none dark:text-cream"
            />
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-4 w-full rounded-lg bg-espresso py-2 text-xs font-medium text-cream dark:bg-brand-600">
        Cevap Anahtarını Kaydet
      </button>
    </Modal>
  );
}

function Viewfinder({ stage }: { stage: Stage }) {
  return (
    <>
      <div className="absolute left-4 top-4 h-6 w-6 border-l-2 border-t-2 border-brand-500" />
      <div className="absolute right-4 top-4 h-6 w-6 border-r-2 border-t-2 border-brand-500" />
      <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-brand-500" />
      <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-brand-500" />

      {stage === "scanning" ? (
        <motion.div
          className="absolute inset-x-8 h-0.5 bg-brand-500 shadow-[0_0_10px_rgb(var(--brand-500))]"
          animate={{ top: ["10%", "90%", "10%"] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : (
        <p className="px-4 text-center text-xs text-cream/50">Cevap kağıdını çerçeveye hizalayın</p>
      )}

      {stage === "done" && (
        <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} className="absolute">
          <CheckCircle2 className="h-12 w-12 text-green-400" />
        </motion.div>
      )}
    </>
  );
}

export function OpticalScannerTab() {
  const { subject, assignedBranches, staffRecord } = useTeacherScope();
  const { showError } = useToast();
  const [stage, setStage] = useState<Stage>("idle");
  const [sheets, setSheets] = useState<ScannedSheet[]>([]);
  const [answerKey, setAnswerKey] = useState<string[]>(["A", "B", "C", "A", "D", "B", "C", "A", "D", "B"]);
  const [isKeyOpen, setIsKeyOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [roster, setRoster] = useState<RosterStudent[]>([]);

  useEffect(() => {
    fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => {
        setExams(data.exams ?? []);
        setExamId((current) => current || data.exams?.[0]?.id || "");
      })
      .catch(() => showError("Sınav listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (assignedBranches.length === 0) return;
    fetch(`/api/students?branchIds=${assignedBranches.map((b) => b.id).join(",")}`)
      .then((res) => res.json())
      .then((data) => setRoster(data.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches.map((b) => b.id).join(",")]);

  function startScan() {
    if (!examId || roster.length === 0) {
      showError("Önce bir deneme sınavı seçin.");
      return;
    }
    setStage("scanning");
    setTimeout(async () => {
      const student = roster[Math.floor(Math.random() * roster.length)];
      const correct = Math.round(answerKey.length * (0.4 + Math.random() * 0.55));
      const wrong = answerKey.length - correct;
      const branch = assignedBranches.find((b) => b.id === student.branchId);

      try {
        const res = await fetch(`/api/exams/${encodeURIComponent(examId)}/net-results`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.id, subject, correct, wrong }),
        });
        if (!res.ok) throw new Error();
        const sheet: ScannedSheet = {
          id: crypto.randomUUID(),
          studentName: `${student.firstName} ${student.lastName}`,
          branchName: branch?.name ?? "—",
          correct,
          total: answerKey.length,
          scannedAt: "az önce",
        };
        setSheets((prev) => [sheet, ...prev]);
      } catch {
        showError("Sonuç kaydedilemedi.");
      } finally {
        setStage("done");
        setTimeout(() => {
          setStage("idle");
          setIsFullscreen(false);
        }, 1500);
      }
    }, 1800);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="flex flex-col items-center rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex w-full items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Camera className="h-4 w-4 text-brand-600" /> Optik Okuyucu
          </h2>
          <button
            onClick={() => setIsKeyOpen(true)}
            className="flex min-h-[32px] items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[10px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <KeyRound className="h-3 w-3" /> Cevap Anahtarı
          </button>
        </div>

        <select
          value={examId}
          onChange={(event) => setExamId(event.target.value)}
          className="mb-4 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>{exam.name}</option>
          ))}
          {exams.length === 0 && <option value="">Deneme sınavı yok</option>}
        </select>

        {/* Masaüstünde: kart içi küçük viewfinder */}
        <div className="relative mb-4 hidden h-48 w-full items-center justify-center overflow-hidden rounded-2xl bg-espresso dark:bg-midnight md:flex">
          <Viewfinder stage={stage} />
        </div>
        <button
          onClick={startScan}
          disabled={stage !== "idle"}
          className="hidden w-full items-center justify-center gap-2 rounded-lg bg-espresso py-2.5 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500 md:flex"
        >
          <ScanLine className="h-3.5 w-3.5" /> {stage === "scanning" ? "Taranıyor..." : "Taramayı Başlat"}
        </button>

        {/* Mobilde: tam ekran kamera modunu açan büyük tetikleyici */}
        <button
          onClick={() => setIsFullscreen(true)}
          className="flex min-h-[64px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl bg-espresso text-sm font-semibold text-cream transition active:scale-[0.98] dark:bg-brand-600 md:hidden"
        >
          <Maximize2 className="h-5 w-5" />
          Kamerayı Aç ve Tara
        </button>

        <p className="mt-2 text-[10px] text-espresso-muted dark:text-cream/40">{answerKey.length} soruluk cevap anahtarına göre eşleştirilir · {subject}</p>
        <p className="mt-1 text-[9px] text-espresso-muted/70 dark:text-cream/30" title={staffRecord.name}>Sonuç, seçilen sınav için gerçek Net Takipçisi&apos;ne kaydedilir.</p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Bugün Taranan Kağıtlar ({sheets.length})</h2>
        <div className="space-y-2">
          <AnimatePresence>
            {sheets.map((sheet) => (
              <motion.div
                key={sheet.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <div>
                  <p className="text-sm font-medium text-espresso dark:text-cream">{sheet.studentName}</p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">{sheet.branchName} · {sheet.scannedAt}</p>
                </div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
                  {sheet.correct}/{sheet.total}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {sheets.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz kağıt taranmadı.</p>}
        </div>
      </motion.div>

      <AnswerKeyModal isOpen={isKeyOpen} onClose={() => setIsKeyOpen(false)} answers={answerKey} setAnswers={setAnswerKey} />

      {/* Mobil tam ekran kamera görünümü — native kamera app hissi */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex flex-col bg-black md:hidden"
          >
            <div
              className="flex shrink-0 items-center justify-between px-4 pt-3"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
            >
              <button
                onClick={() => {
                  if (stage !== "scanning") setIsFullscreen(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <X className="h-5 w-5" />
              </button>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                {answerKey.length} soruluk anahtar
              </span>
              <button
                onClick={() => setIsKeyOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <KeyRound className="h-4 w-4" />
              </button>
            </div>

            <div className="relative m-4 flex flex-1 items-center justify-center overflow-hidden rounded-3xl bg-espresso">
              <Viewfinder stage={stage} />
            </div>

            <div className="shrink-0 px-6 pb-6" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
              <button
                onClick={startScan}
                disabled={stage !== "idle"}
                className={cn(
                  "flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold text-white transition active:scale-[0.98]",
                  stage === "idle" ? "bg-brand-600" : "bg-white/20"
                )}
              >
                <ScanLine className="h-5 w-5" /> {stage === "scanning" ? "Taranıyor..." : stage === "done" ? "Tamamlandı" : "Taramayı Başlat"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
