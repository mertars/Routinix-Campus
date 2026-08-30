"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FileQuestion, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { XrayDiagnosticTest } from "@/components/student/tabs/xray-diagnostic-test";
import { XrayPracticeBanner } from "@/components/student/tabs/xray-practice-banner";
import { XrayComprehensionBanner } from "@/components/student/tabs/xray-comprehension-banner";
import { XraySelfProgressCard } from "@/components/student/tabs/xray-self-progress-card";
import { XrayGoalsCard } from "@/components/student/tabs/xray-goals-card";
import { cn } from "@/lib/utils";

type ExamBreakdown = { examId: string; examName: string; examDate: string; totalNet: number; subjects: { subject: string; net: number }[] };

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (Math.abs(delta) < 0.01) {
    return (
      <span className="flex items-center gap-1 rounded-full bg-cream-muted px-2 py-0.5 text-[10px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/50">
        <Minus className="h-3 w-3" /> Değişim yok
      </span>
    );
  }
  const isUp = delta > 0;
  return (
    <span
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
        isUp ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
      )}
    >
      {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isUp ? "+" : ""}
      {delta} net
    </span>
  );
}

export function XrayTab() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [exams, setExams] = useState<ExamBreakdown[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/students/${encodeURIComponent(studentId)}/net-summary`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        const list: ExamBreakdown[] = data.examBreakdown ?? [];
        setExams(list);
        setExpanded((current) => current ?? list[0]?.examId ?? null);
      })
      .catch(() => showError("Röntgen karnesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  return (
    <div className="space-y-4">
      <XrayComprehensionBanner />
      <XrayPracticeBanner />
      <XraySelfProgressCard />
      <XrayGoalsCard />
      <XrayDiagnosticTest />

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <FileQuestion className="h-4 w-4 text-brand-600" /> Deneme Bazlı Röntgen Karnesi
        </h2>
        <div className="space-y-2">
          {exams?.map((exam, index) => {
            const isExpanded = expanded === exam.examId;
            const previous = exams[index + 1]; // liste en yeniden en eskiye sıralı
            const delta = previous ? Math.round((exam.totalNet - previous.totalNet) * 100) / 100 : null;
            return (
              <div key={exam.examId} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
                <button
                  onClick={() => setExpanded(isExpanded ? null : exam.examId)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-2 px-3.5 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-espresso dark:text-cream">{exam.examName}</p>
                    <p className="text-[10px] text-espresso-muted dark:text-cream/40">{new Date(exam.examDate).toLocaleDateString("tr-TR")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <DeltaBadge delta={delta} />
                    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">{exam.totalNet}</span>
                    <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
                  </div>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-1.5 px-3.5 pb-3.5">
                        {exam.subjects.map((s) => (
                          <div key={s.subject} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 dark:bg-midnight-card">
                            <span className="text-xs font-medium text-espresso dark:text-cream">{s.subject}</span>
                            <span className="text-xs font-semibold text-brand-600">{s.net}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {exams === null && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
          {exams?.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz deneme sınavı sonucun işlenmedi.</p>}
        </div>
      </motion.div>
    </div>
  );
}
