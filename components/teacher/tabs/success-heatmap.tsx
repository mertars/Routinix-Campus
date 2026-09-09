"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Map, ChevronDown, Loader2, Info } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { cn } from "@/lib/utils";

type Student = { id: string; name: string };
type Row = { subtopicId: string; topic: string; subtopic: string; scores: (number | null)[] };
type Payload = {
  branchName: string;
  subject: string;
  students: Student[];
  rows: Row[];
  measuredCells?: number;
  reason?: string;
};

// ⚠️ Bu ekran daha önce UYDURMA VERİ gösteriyordu.
//
// Puanlar lib/mock-data.ts'teki sabit TOPIC_HEATMAP dizisinden geliyor
// ve `row.scores[colIndex % row.scores.length]` ile seçiliyordu — yani
// puan öğrenciye değil, öğrencinin LİSTEDEKİ SIRASINA bağlıydı.
// Listedeki birinci öğrenci kim olursa olsun Fonksiyonlar'dan hep 92
// alıyordu. Başlıkta gerçek isimler vardı ve ekranda hiçbir uyarı
// yoktu; öğretmen bu tabloya bakıp ödev veriyor, veli arıyordu.
//
// Artık veri /api/teacher/heatmap'ten (TopicMasteryAssessment) gelir ve
// ölçülmemiş hücre UYDURULMAZ: "—" gösterilir.

function cellTone(score: number) {
  if (score >= 80) return "bg-green-600 text-white";
  if (score >= 60) return "bg-brand-500 text-white";
  if (score >= 40) return "bg-brand-300 text-espresso";
  return "bg-rose-400 text-white";
}

const EMPTY_CELL = "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/30";

const LEGEND = (
  <div className="flex flex-wrap items-center gap-3 text-[10px] text-espresso-muted dark:text-cream/40">
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-600" /> %80+</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-500" /> %60-79</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-300" /> %40-59</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> %40 altı</span>
    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-cream-card dark:bg-white/10" /> ölçülmedi</span>
  </div>
);

export function SuccessHeatmapTab() {
  const { subject, assignedBranches } = useTeacherScope();
  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);

  useEffect(() => {
    if (assignedBranches.length > 0 && !branchId) setBranchId(assignedBranches[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches]);

  const load = useCallback(async () => {
    if (!branchId || !subject) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/teacher/heatmap?branchId=${encodeURIComponent(branchId)}&subject=${encodeURIComponent(subject)}`
      );
      const payload = res.ok ? ((await res.json()) as Payload) : null;
      setData(payload);
      setExpandedTopic(payload?.rows[0]?.subtopicId ?? null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, subject]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = data?.students ?? [];
  const rows = data?.rows ?? [];

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
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Map className="h-4 w-4 text-brand-600" /> Sınıf Başarı Isı Haritası — {subject}
        </h2>
        <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
          Kazanım ölçümlerinden hesaplanır. Ölçümü olmayan hücre boş bırakılır — tahmin edilmez.
        </p>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}

        {/* Veri yoksa SEBEBİ yazılır: boş bir tablo "sistem bozuk" gibi
            okunur, oysa henüz ölçüm yapılmamış olabilir. */}
        {!loading && rows.length === 0 && (
          <div className="flex items-start gap-2 rounded-2xl bg-cream-card p-4 dark:bg-white/5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/40" />
            <div>
              <p className="text-xs text-espresso dark:text-cream">
                {data?.reason ?? "Bu şube ve ders için henüz kazanım ölçümü yok."}
              </p>
              <p className="mt-1 text-[11px] text-espresso-muted dark:text-cream/40">
                Ölçümler, soru numaralı deneme sonuçları yüklendiğinde otomatik oluşur.
              </p>
            </div>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Masaüstü: tam matris tablo (md ve üstü) */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-espresso-muted dark:text-cream/40">Kazanım</th>
                    {students.map((student) => (
                      <th key={student.id} className="px-1 py-2 text-center font-medium text-espresso-muted dark:text-cream/40">
                        {student.name.split(" ")[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={row.subtopicId} className="border-t border-hairline dark:border-white/5">
                      <td className="px-2 py-1.5 font-medium text-espresso dark:text-cream">
                        {row.subtopic}
                        <span className="ml-1 text-[10px] font-normal text-espresso-muted dark:text-cream/30">{row.topic}</span>
                      </td>
                      {students.map((student, colIndex) => {
                        const score = row.scores[colIndex];
                        return (
                          <td key={student.id} className="p-1">
                            <motion.div
                              initial={{ opacity: 0, scale: 0.7 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: (rowIndex * students.length + colIndex) * 0.02 }}
                              title={
                                score === null
                                  ? `${student.name} · ${row.subtopic}: ölçüm yok`
                                  : `${student.name} · ${row.subtopic}: %${score}`
                              }
                              className={cn(
                                "flex h-8 items-center justify-center rounded-lg text-[10px] font-semibold",
                                score === null ? EMPTY_CELL : cellTone(score)
                              )}
                            >
                              {score === null ? "—" : score}
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

            {/* Mobil: kazanım bazlı akordiyon */}
            <div className="space-y-2 md:hidden">
              {rows.map((row) => {
                const isExpanded = expandedTopic === row.subtopicId;
                return (
                  <div key={row.subtopicId} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
                    <button
                      onClick={() => setExpandedTopic(isExpanded ? null : row.subtopicId)}
                      className="flex min-h-[52px] w-full items-center justify-between px-3.5 text-left"
                    >
                      <span className="text-sm font-medium text-espresso dark:text-cream">{row.subtopic}</span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-espresso-muted transition-transform dark:text-cream/40",
                          isExpanded && "rotate-180"
                        )}
                      />
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
                            {students.map((student, colIndex) => {
                              const score = row.scores[colIndex];
                              return (
                                <div
                                  key={student.id}
                                  className={cn(
                                    "flex min-w-[92px] flex-1 items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold",
                                    score === null ? EMPTY_CELL : cellTone(score)
                                  )}
                                >
                                  <span className="truncate">{student.name.split(" ")[0]}</span>
                                  <span>{score === null ? "—" : score}</span>
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
              <div className="pt-2">{LEGEND}</div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
