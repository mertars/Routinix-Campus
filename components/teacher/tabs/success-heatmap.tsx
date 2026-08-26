"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, ChevronDown } from "lucide-react";
import { TOPIC_HEATMAP } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type RosterStudent = { id: string; name: string };

function cellTone(score: number) {
  if (score >= 80) return "bg-green-600 text-white";
  if (score >= 60) return "bg-brand-500 text-white";
  if (score >= 40) return "bg-brand-300 text-espresso";
  return "bg-rose-400 text-white";
}

const LEGEND = (
  <div className="flex flex-wrap items-center gap-3 text-[10px] text-espresso-muted dark:text-cream/40">
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> %80+</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> %60-79</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-300" /> %40-59</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> %40 altı</span>
  </div>
);

export function SuccessHeatmapTab() {
  const { subject, assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const rows = TOPIC_HEATMAP[subject] ?? [];
  const [expandedTopic, setExpandedTopic] = useState<string | null>(rows[0]?.topic ?? null);

  useEffect(() => {
    if (assignedBranches.length > 0 && !branchId) setBranchId(assignedBranches[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches]);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/students?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => setRoster((data.students ?? []).slice(0, 6).map((s: { id: string; firstName: string; lastName: string }) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  return (
    <div className="space-y-4">
      <select
        value={branchId}
        onChange={(event) => setBranchId(event.target.value)}
        className="min-h-[44px] rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
      >
        {assignedBranches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Map className="h-4 w-4 text-brand-600" /> Sınıf Başarı Isı Haritası — {subject}
        </h2>

        {/* Masaüstü: tam matris tablo (md ve üstü) */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr>
                <th className="px-2 py-2 text-left font-medium text-espresso-muted dark:text-cream/40">Konu</th>
                {roster.map((student) => (
                  <th key={student.id} className="px-1 py-2 text-center font-medium text-espresso-muted dark:text-cream/40">
                    {student.name.split(" ")[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.topic} className="border-t border-hairline dark:border-white/5">
                  <td className="px-2 py-1.5 font-medium text-espresso dark:text-cream">{row.topic}</td>
                  {roster.map((student, colIndex) => {
                    const score = row.scores[colIndex % row.scores.length];
                    return (
                      <td key={student.id} className="p-1">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (rowIndex * roster.length + colIndex) * 0.02 }}
                          title={`${student.name} · ${row.topic}: %${score}`}
                          className={cn("flex h-8 items-center justify-center rounded-lg text-[10px] font-semibold", cellTone(score))}
                        >
                          {score}
                        </motion.div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4">{LEGEND}</div>
        </div>

        {/* Mobil: konu bazlı akordiyon, her konu açılınca öğrenci chip'leri */}
        <div className="space-y-2 md:hidden">
          {rows.map((row) => {
            const isExpanded = expandedTopic === row.topic;
            return (
              <div key={row.topic} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
                <button
                  onClick={() => setExpandedTopic(isExpanded ? null : row.topic)}
                  className="flex min-h-[52px] w-full items-center justify-between px-3.5 text-left"
                >
                  <span className="text-sm font-medium text-espresso dark:text-cream">{row.topic}</span>
                  <ChevronDown className={cn("h-4 w-4 shrink-0 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-wrap gap-2 px-3.5 pb-3.5">
                        {roster.map((student, colIndex) => {
                          const score = row.scores[colIndex % row.scores.length];
                          return (
                            <div
                              key={student.id}
                              className={cn("flex min-w-[92px] flex-1 items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold", cellTone(score))}
                            >
                              <span className="truncate">{student.name.split(" ")[0]}</span>
                              <span>{score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
          <div className="pt-1">{LEGEND}</div>
        </div>
      </motion.div>
    </div>
  );
}
