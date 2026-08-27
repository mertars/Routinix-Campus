"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Puzzle, CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, RotateCcw } from "lucide-react";
import { STUDENT_TOPIC_ANALYSIS, QUESTION_POOL } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type RemediationTask = { id: string; topic: string; taskDescription: string; assignedAt: string };

export function GapClosingTab() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const exams = STUDENT_TOPIC_ANALYSIS[studentId] ?? [];
  const latest = exams.find((e) => e.hasTopicData);
  const weakTopics = (latest?.topics ?? []).filter((t) => t.successRate < 75).sort((a, b) => a.successRate - b.successRate);

  const generatedTest = useMemo(
    () => QUESTION_POOL.filter((q) => weakTopics.some((t) => q.topic.toLocaleLowerCase("tr").includes(t.name.toLocaleLowerCase("tr")) || t.name.toLocaleLowerCase("tr").includes(q.topic.toLocaleLowerCase("tr")))),
    [weakTopics]
  );

  const [myTasks, setMyTasks] = useState<RemediationTask[]>([]);

  useEffect(() => {
    fetch(`/api/remediation-tasks?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setMyTasks(data.tasks ?? []))
      .catch(() => showError("Görevler yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const [isTestOpen, setIsTestOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [answered, setAnswered] = useState<Record<string, boolean>>({});

  function openTest() {
    setIndex(0);
    setIsTestOpen(true);
  }

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Puzzle className="h-4 w-4 text-brand-600" /> Zayıf Konuların
        </h2>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {weakTopics.map((t) => (
            <span key={t.name} className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
              {t.name} · %{t.successRate}
            </span>
          ))}
          {weakTopics.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Şu anda belirgin zayıf konu tespit edilmedi, harika!</p>}
        </div>

        {generatedTest.length > 0 && (
          <button
            onClick={openTest}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <RotateCcw className="h-4 w-4" /> Kişisel Eksik Kapatma Testini Başlat ({generatedTest.length} soru)
          </button>
        )}
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <ClipboardList className="h-4 w-4 text-brand-600" /> Öğretmen Tarafından Atanan Görevler
        </h2>
        <div className="space-y-2">
          {myTasks.map((task) => (
            <div key={task.id} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
              <p className="text-sm font-medium text-espresso dark:text-cream">{task.topic}</p>
              <p className="text-xs text-espresso-muted dark:text-cream/50">{task.taskDescription}</p>
              <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(task.assignedAt).toLocaleDateString("tr-TR")}</p>
            </div>
          ))}
          {myTasks.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Öğretmeninden atanmış bir görev yok.</p>}
        </div>
      </motion.div>

      <Modal isOpen={isTestOpen} onClose={() => setIsTestOpen(false)} title="Eksik Kapatma Testi">
        {generatedTest[index] && (
          <div>
            <p className="mb-1 text-[11px] font-medium text-espresso-muted dark:text-cream/40">
              Soru {index + 1}/{generatedTest.length} · {generatedTest[index].topic}
            </p>
            <div className="mb-3 rounded-2xl bg-cream-card p-4 text-sm text-espresso dark:bg-white/5 dark:text-cream">{generatedTest[index].questionText}</div>
            <button
              onClick={() => setAnswered((prev) => ({ ...prev, [generatedTest[index].id]: true }))}
              className={cn(
                "mb-3 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-medium transition",
                answered[generatedTest[index].id] ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-cream-card text-espresso dark:bg-white/5 dark:text-cream"
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> {answered[generatedTest[index].id] ? "Çözüldü olarak işaretlendi" : "Çözdüm, işaretle"}
            </button>
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="flex min-h-[44px] items-center gap-1 rounded-lg border border-hairline px-3 text-xs font-medium text-espresso disabled:opacity-40 dark:border-white/10 dark:text-cream"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Geri
              </button>
              <button
                onClick={() => (index < generatedTest.length - 1 ? setIndex((i) => i + 1) : setIsTestOpen(false))}
                className="flex min-h-[44px] items-center gap-1 rounded-lg bg-espresso px-4 text-xs font-semibold text-cream dark:bg-brand-600"
              >
                {index < generatedTest.length - 1 ? "İleri" : "Bitir"} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
