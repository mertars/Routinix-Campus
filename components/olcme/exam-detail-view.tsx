"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, KeyRound, UploadCloud, BarChart3, Sparkles, Check, CalendarDays, ScanLine } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { AnswerKeyPanel } from "./answer-key-panel";
import { ResultsUploadPanel } from "./results-upload-panel";
import { ResultsTable } from "./results-table";
import { KazanimPanel } from "./kazanim-panel";
import { type ExamOverview, formatExamDate } from "./types";

type StepId = "answer-key" | "upload" | "report" | "kazanim";

const STEPS: { id: StepId; label: string; icon: typeof KeyRound; optional?: boolean }[] = [
  { id: "answer-key", label: "Cevap Anahtarı", icon: KeyRound },
  { id: "upload", label: "Sonuçları Yükle", icon: UploadCloud },
  { id: "report", label: "Rapor", icon: BarChart3 },
  { id: "kazanim", label: "Kazanım", icon: Sparkles, optional: true },
];

// Bir denemenin tüm işi tek ekranda, dört adımda. Adımlar hem ilerleme
// göstergesi hem navigasyon — tamamlananlar tik alır, aktif olan
// vurgulanır, hepsi her zaman tıklanabilir (geri dönüp düzeltmek serbest,
// kilitli sihirbaz akışı kullanıcıyı sıkıştırırdı).
export function ExamDetailView({ examId, onBack }: { examId: string; onBack: () => void }) {
  const { showError } = useToast();
  const [overview, setOverview] = useState<ExamOverview | null>(null);
  const [step, setStep] = useState<StepId | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/exams/${examId}/overview`).catch(() => null);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data) {
      showError("Deneme yüklenemedi.");
      return null;
    }
    setOverview(data);
    return data as ExamOverview;
  }, [examId, showError]);

  useEffect(() => {
    setOverview(null);
    setStep(null);
    load().then((data) => {
      if (!data) return;
      // İlk açılışta kullanıcıyı KALDIĞI yere bırak: anahtar yoksa 1.,
      // sonuç yoksa 2., ikisi de varsa doğrudan rapora.
      const hasAnyKey = data.subjects.some((s) => s.answeredCount > 0);
      setStep(!hasAnyKey ? "answer-key" : data.studentCount === 0 ? "upload" : "report");
    });
  }, [examId, load]);

  if (!overview || !step) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const keyedSubjects = overview.subjects.filter((s) => s.answeredCount > 0).length;
  const done: Record<StepId, boolean> = {
    "answer-key": keyedSubjects > 0 && keyedSubjects === overview.subjects.length,
    upload: overview.studentCount > 0,
    report: overview.studentCount > 0,
    kazanim: overview.subjects.some((s) => s.questionCount > 0 && s.answeredCount > 0 && s.resultCount > 0),
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Tüm denemeler
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-espresso dark:text-cream">{overview.exam.name}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-espresso-muted dark:text-cream/40">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3" /> {formatExamDate(overview.exam.examDate)}
          </span>
          {overview.format && (
            <span className="flex items-center gap-1.5">
              <ScanLine className="h-3 w-3" /> {overview.format.name}
            </span>
          )}
          <span>{overview.subjects.length} ders</span>
          {overview.studentCount > 0 && <span className="font-medium text-emerald-700 dark:text-emerald-400">{overview.studentCount} öğrenci sonuçlandı</span>}
        </div>
      </div>

      {/* Adım göstergesi + navigasyon */}
      <div className="mb-6 flex flex-wrap gap-1.5 rounded-2xl border border-hairline bg-white/60 p-1.5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        {STEPS.map((s, i) => {
          const active = step === s.id;
          const complete = done[s.id];
          return (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11.5px] font-semibold transition",
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : complete
                    ? "text-emerald-700 hover:bg-emerald-500/5 dark:text-emerald-400"
                    : "text-espresso-muted hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/5"
              )}
            >
              <span
                className={cn(
                  "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                  active ? "bg-white/25 text-white" : complete ? "bg-emerald-500/15" : "bg-cream-muted dark:bg-white/10"
                )}
                style={{ height: "1.125rem", width: "1.125rem" }}
              >
                {complete && !active ? <Check className="h-2.5 w-2.5" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
              {s.optional && <span className={cn("hidden text-[9px] font-normal opacity-60 lg:inline", active && "text-white")}>ops.</span>}
            </button>
          );
        })}
      </div>

      <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        {step === "answer-key" && <AnswerKeyPanel overview={overview} onSaved={load} />}
        {step === "upload" && (
          <ResultsUploadPanel
            overview={overview}
            // Sonuçlar kaydedilir kaydedilmez rapora düşür — yöneticinin
            // aradığı çıktı zaten o, ayrıca bir sekmeye tıklatmayalım.
            onSaved={async () => {
              await load();
              setStep("report");
            }}
            onFormatChanged={load}
          />
        )}
        {step === "report" && <ResultsTable examId={examId} />}
        {step === "kazanim" && <KazanimPanel overview={overview} />}
      </motion.div>
    </div>
  );
}
