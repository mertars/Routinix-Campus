"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan, ChevronDown, FileQuestion } from "lucide-react";
import { STUDENT_TOPIC_ANALYSIS } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { cn } from "@/lib/utils";

function cellTone(score: number) {
  if (score >= 75) return "bg-green-600 text-white";
  if (score >= 50) return "bg-brand-400 text-white";
  return "bg-rose-500 text-white";
}

const LEGEND = (
  <div className="flex flex-wrap items-center gap-3 text-[10px] text-espresso-muted dark:text-cream/40">
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Güçlü (%75+)</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-400" /> Orta (%50-74)</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Zayıf (%50 altı)</span>
  </div>
);

export function XrayTab() {
  const { studentId } = useStudentScope();
  const exams = STUDENT_TOPIC_ANALYSIS[studentId] ?? [];
  const [expanded, setExpanded] = useState<string | null>(exams.find((e) => e.hasTopicData)?.examName ?? null);

  const latestWithData = exams.find((e) => e.hasTopicData);

  return (
    <div className="space-y-4">
      {latestWithData?.topics && (
        <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Scan className="h-4 w-4 text-brand-600" /> Konu Isı Haritası — {latestWithData.examName}
          </h2>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {latestWithData.topics.map((topic) => (
              <div key={topic.name} className={cn("flex flex-col items-center justify-center rounded-2xl p-3 text-center", cellTone(topic.successRate))}>
                <span className="text-lg font-bold">%{topic.successRate}</span>
                <span className="text-[10px] font-medium leading-tight">{topic.name}</span>
              </div>
            ))}
          </div>
          {LEGEND}
        </motion.div>
      )}

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <FileQuestion className="h-4 w-4 text-brand-600" /> Deneme Bazlı Röntgen Karnesi
        </h2>
        <div className="space-y-2">
          {exams.map((exam) => {
            const isExpanded = expanded === exam.examName;
            return (
              <div key={exam.examName} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
                <button
                  onClick={() => setExpanded(isExpanded ? null : exam.examName)}
                  disabled={!exam.hasTopicData}
                  className="flex min-h-[48px] w-full items-center justify-between px-3.5 text-left disabled:opacity-60"
                >
                  <span className="text-sm font-medium text-espresso dark:text-cream">{exam.examName}</span>
                  {exam.hasTopicData ? (
                    <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
                  ) : (
                    <span className="text-[10px] text-espresso-muted dark:text-cream/40">Konu verisi yok</span>
                  )}
                </button>
                <AnimatePresence>
                  {isExpanded && exam.topics && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-1.5 px-3.5 pb-3.5">
                        {exam.topics.map((topic) => (
                          <div key={topic.name} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 dark:bg-midnight-card">
                            <span className="text-xs font-medium text-espresso dark:text-cream">{topic.name}</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", cellTone(topic.successRate))}>%{topic.successRate}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          {exams.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz deneme sınavı verisi yok.</p>}
        </div>
      </motion.div>
    </div>
  );
}
