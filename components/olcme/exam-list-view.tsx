"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Search, CalendarDays, Users, KeyRound, ScanLine, FileBarChart } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { NewExamWizard } from "./new-exam-wizard";
import { type ExamListItem, formatExamDate } from "./types";

type Status = { label: string; className: string };

// Bir denemenin hangi aşamada olduğunu TEK bakışta anlatan rozet. Üç
// durum yeter — daha fazlası kart listesini okunmaz yapar.
function statusOf(exam: ExamListItem): Status {
  if (exam.studentCount > 0) return { label: "Sonuçlandı", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (exam.answerKeySubjectCount > 0) return { label: "Sonuç bekliyor", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" };
  return { label: "Hazırlanıyor", className: "border-hairline bg-cream-card text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40" };
}

export function ExamListView({ onSelect }: { onSelect: (examId: string) => void }) {
  const { showError } = useToast();
  const [exams, setExams] = useState<ExamListItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  function load() {
    return fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => setExams(data.exams ?? []))
      .catch(() => showError("Denemeler yüklenemedi."));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!exams) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return exams;
    return exams.filter((e) => e.name.toLocaleLowerCase("tr-TR").includes(q));
  }, [exams, query]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-10">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-espresso dark:text-cream">Denemeler</h1>
          <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">
            Cevap anahtarını ve optik sonuç dosyasını yapıştır — netler, sıralamalar ve kazanım analizi otomatik çıksın.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" /> Yeni Deneme
        </button>
      </div>

      {exams !== null && exams.length > 6 && (
        <div className="relative mb-5 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Deneme ara..."
            className="w-full rounded-xl border border-hairline bg-white/70 py-2.5 pl-8 pr-3 text-xs text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
          />
        </div>
      )}

      {exams === null ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-hairline bg-white/40 py-24 text-center dark:border-white/10 dark:bg-white/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
            <FileBarChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-espresso dark:text-cream">{exams.length === 0 ? "Henüz deneme yok" : "Sonuç bulunamadı"}</p>
          {exams.length === 0 && (
            <>
              <p className="max-w-xs text-xs text-espresso-muted dark:text-cream/40">
                İlk denemeni oluştur — bir kez optik şablonu tanımladıktan sonra sonraki denemeler saniyeler sürer.
              </p>
              <button
                onClick={() => setWizardOpen(true)}
                className="mt-1 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" /> Yeni Deneme
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((exam, i) => {
            const status = statusOf(exam);
            return (
              <motion.button
                key={exam.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => onSelect(exam.id)}
                className="group flex flex-col gap-3 rounded-2xl border border-hairline bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-md dark:border-white/10 dark:bg-midnight-card/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-sm font-semibold leading-snug text-espresso dark:text-cream">{exam.name}</span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold", status.className)}>{status.label}</span>
                </div>

                <span className="flex items-center gap-1.5 text-[11px] text-espresso-muted dark:text-cream/40">
                  <CalendarDays className="h-3 w-3" /> {formatExamDate(exam.examDate)}
                </span>

                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-3 text-[10.5px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
                  <span className="flex items-center gap-1">
                    <ScanLine className="h-3 w-3" /> {exam.subjectCount} ders
                  </span>
                  <span className={cn("flex items-center gap-1", exam.answerKeySubjectCount > 0 && "text-emerald-700 dark:text-emerald-400")}>
                    <KeyRound className="h-3 w-3" /> {exam.answerKeySubjectCount}/{exam.subjectCount} anahtar
                  </span>
                  <span className={cn("flex items-center gap-1", exam.studentCount > 0 && "text-emerald-700 dark:text-emerald-400")}>
                    <Users className="h-3 w-3" /> {exam.studentCount} öğrenci
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <NewExamWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={async (newExamId) => {
          setWizardOpen(false);
          await load();
          onSelect(newExamId);
        }}
      />
    </div>
  );
}
