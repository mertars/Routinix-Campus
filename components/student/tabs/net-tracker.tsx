"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Target, Users, Trophy, Globe2, Pencil, ClipboardList, ChevronDown, Loader2, FileDown } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { TargetNetModal, type TargetNetValues } from "@/components/student/target-net-modal";
import { cn } from "@/lib/utils";

type SubtopicBreakdownRow = { subtopicId: string | null; subtopicLabel: string; total: number; correct: number; wrong: number; blank: number; percent: number };
type ExamSubjectResult = { subject: string; net: number; breakdown: SubtopicBreakdownRow[] | null };
type ExamResult = { examId: string; examName: string; examDate: string; subjects: ExamSubjectResult[] };

function scoreTone(percent: number) {
  if (percent < 30) return { bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" };
  if (percent < 60) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" };
  return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" };
}

type NetSummary = {
  targetNet: number | null;
  targetNetTyt: number | null;
  targetNetAyt: number | null;
  segment: "LGS" | "YKS" | "MEZUN";
  actualNet: number;
  trendBySubject: Record<string, { examLabel: string; net: number }[]>;
  branchRank: number;
  institutionRank: number;
  estimatedNationwidePercentile: number;
};

function NetTrendChart({ points }: { points: { examLabel: string; net: number }[] }) {
  const width = 300;
  const height = 90;
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => `${i * step},${height - ((p.net - min) / range) * (height - 16) - 8}`).join(" ");

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible text-brand-600">
        <motion.polyline
          points={coords}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
        {points.map((p, i) => (
          <circle key={p.examLabel} cx={i * step} cy={height - ((p.net - min) / range) * (height - 16) - 8} r={3} fill="currentColor" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-espresso-muted dark:text-cream/30">
        {points.map((p) => (
          <span key={p.examLabel}>{p.examLabel.replace("Deneme-", "D")}</span>
        ))}
      </div>
    </div>
  );
}

export function NetTrackerTab() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [summary, setSummary] = useState<NetSummary | null>(null);
  const [editingTarget, setEditingTarget] = useState(false);
  const [exams, setExams] = useState<ExamResult[] | null>(null);
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/students/${encodeURIComponent(studentId)}/net-summary`)
      .then((res) => res.json())
      .then((data) => setSummary(data))
      .catch(() => showError("Net verisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Kazanım bazlı kırılım (2026-09-05) — yukarıdaki net trendi ZATEN
  // vardı, buraya SADECE edesis karşılaştırmasında bulduğumuz gerçek
  // eksiği (doğru/yanlış/boş oranı + Hata Karnesi) ekliyoruz — ayrı bir
  // sekme AÇMADIK, "deneme sonuçların nerede" sorusunun TEK cevabı hâlâ
  // bu tab olsun diye.
  useEffect(() => {
    fetch("/api/exams/my-results")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setExams(data.exams ?? []))
      .catch(() => {});
  }, []);

  async function downloadHataKarnesi(examId: string, subject: string) {
    const key = `${examId}:${subject}`;
    setDownloadingKey(key);
    try {
      const res = await fetch(`/api/exams/${examId}/hata-karnesi?subject=${encodeURIComponent(subject)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Hata karnesi oluşturulamadı.");
      }
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Hata karnesi oluşturulamadı.");
    } finally {
      setDownloadingKey(null);
    }
  }

  if (!summary) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>;
  }

  const delta = summary.actualNet - (summary.targetNet ?? summary.actualNet);

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Target className="h-4 w-4 text-brand-600" /> Hedef vs. Gerçekleşen Net
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="relative rounded-2xl bg-cream-card p-4 text-center dark:bg-white/5">
            <button
              onClick={() => setEditingTarget(true)}
              aria-label="Hedef Neti Düzenle"
              className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white text-espresso-muted transition hover:text-brand-600 dark:bg-white/10 dark:text-cream/50"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Hedef Net</p>
            <p className="mt-1 text-2xl font-bold text-espresso dark:text-cream">{summary.targetNet ?? "—"}</p>
            {summary.segment === "YKS" && (summary.targetNetTyt !== null || summary.targetNetAyt !== null) && (
              <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">
                TYT {summary.targetNetTyt ?? "—"} · AYT {summary.targetNetAyt ?? "—"}
              </p>
            )}
          </div>
          <div className="rounded-2xl bg-brand-600 p-4 text-center text-white">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/70">Gerçekleşen Net</p>
            <p className="mt-1 text-2xl font-bold">{summary.actualNet}</p>
          </div>
        </div>
        {summary.targetNet !== null && (
          <div className={cn("mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold", delta >= 0 ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300")}>
            {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            Hedefin {Math.abs(delta)} net {delta >= 0 ? "üzerinde" : "altında"}
          </div>
        )}
      </motion.div>

      {Object.entries(summary.trendBySubject).map(([subject, points]) => (
        <motion.div key={subject} whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">{subject} Net Trendi</h2>
          <NetTrendChart points={points} />
        </motion.div>
      ))}

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 text-center backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <Users className="mx-auto mb-1 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{summary.branchRank}.</p>
          <p className="text-[9px] text-espresso-muted dark:text-cream/40">Şube Sıralaması</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 text-center backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <Trophy className="mx-auto mb-1 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">{summary.institutionRank}.</p>
          <p className="text-[9px] text-espresso-muted dark:text-cream/40">Kurum Sıralaması</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-3.5 text-center backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <Globe2 className="mx-auto mb-1 h-4 w-4 text-brand-600" />
          <p className="text-lg font-bold text-espresso dark:text-cream">%{summary.estimatedNationwidePercentile}</p>
          <p className="text-[9px] text-espresso-muted dark:text-cream/40">Tahmini Türkiye Dilimi</p>
        </div>
      </motion.div>
      <p className="text-center text-[10px] text-espresso-muted/70 dark:text-cream/30">
        Türkiye geneli dilim, resmi bir ÖSYM/MEB verisi değil, temsili bir tahmindir.
      </p>

      {exams && exams.length > 0 && (
        <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <ClipboardList className="h-4 w-4 text-brand-600" /> Sınav Bazlı Kazanım Kırılımı
          </h2>
          <div className="space-y-2">
            {exams.map((exam) => {
              const isOpen = expandedExamId === exam.examId;
              return (
                <div key={exam.examId} className="overflow-hidden rounded-2xl border border-hairline dark:border-white/10">
                  <button
                    onClick={() => setExpandedExamId(isOpen ? null : exam.examId)}
                    className="flex w-full items-center justify-between gap-2 bg-cream-card px-3.5 py-2.5 text-left transition hover:bg-cream dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-espresso dark:text-cream">{exam.examName}</span>
                      <span className="block text-[10px] text-espresso-muted dark:text-cream/40">{new Date(exam.examDate).toLocaleDateString("tr-TR")}</span>
                    </span>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-espresso-muted transition-transform dark:text-cream/40", isOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="space-y-4 p-3.5">
                          {exam.subjects.map((s) => {
                            const weak = (s.breakdown ?? []).filter((row) => row.wrong > 0 || row.blank > 0);
                            const canDownload = weak.some((row) => row.subtopicId !== null);
                            const key = `${exam.examId}:${s.subject}`;
                            return (
                              <div key={s.subject}>
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-xs font-semibold text-espresso dark:text-cream">
                                    {s.subject} <span className="font-normal text-espresso-muted dark:text-cream/40">· Net: {s.net}</span>
                                  </p>
                                  {canDownload && (
                                    <button
                                      onClick={() => downloadHataKarnesi(exam.examId, s.subject)}
                                      disabled={downloadingKey === key}
                                      className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-[10.5px] font-semibold text-white transition hover:bg-brand-500 disabled:opacity-50"
                                    >
                                      {downloadingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
                                      Hata Karnesi
                                    </button>
                                  )}
                                </div>
                                {!s.breakdown || s.breakdown.length === 0 ? (
                                  <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">Bu ders için kazanım kırılımı girilmemiş.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {s.breakdown.map((row) => {
                                      const tone = scoreTone(row.percent);
                                      return (
                                        <div key={row.subtopicId ?? row.subtopicLabel}>
                                          <div className="mb-1 flex items-center justify-between gap-2">
                                            <span className="min-w-0 truncate text-[11px] font-medium text-espresso dark:text-cream">{row.subtopicLabel}</span>
                                            <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", tone.text)}>%{row.percent}</span>
                                          </div>
                                          <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                                            <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${row.percent}%` }} />
                                          </div>
                                          <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">
                                            {row.correct} doğru · {row.wrong} yanlış · {row.blank} boş / {row.total} soru
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
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
          </div>
        </motion.div>
      )}

      <TargetNetModal
        isOpen={editingTarget}
        onClose={() => setEditingTarget(false)}
        studentId={studentId}
        segment={summary.segment}
        initial={{ targetNet: summary.targetNet, targetNetTyt: summary.targetNetTyt, targetNetAyt: summary.targetNetAyt }}
        onSaved={(next: TargetNetValues) => setSummary((prev) => (prev ? { ...prev, ...next } : prev))}
      />
    </div>
  );
}
