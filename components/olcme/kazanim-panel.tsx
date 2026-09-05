"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Save, Sparkles, BarChart3, Copy } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { ExamOverview } from "./types";

type QuestionRow = { questionNumber: number; subtopicId: string | null; subtopicLabel: string; correctAnswer: string | null };
type SummaryRow = { subtopicId: string | null; subtopicLabel: string; averagePercent: number; studentCount: number };
type Template = { examId: string; examName: string; examDate: string };

function scoreTone(percent: number) {
  if (percent < 30) return { bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" };
  if (percent < 60) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" };
  return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" };
}

// Kazanım Eşleme — OPSİYONEL adım. Her soruyu bir kazanıma bağlarsan,
// deneme sonuçları Akademik Röntgen'e otomatik akar: öğrencinin zayıf
// konuları güncellenir, Video Ders Merkezi ona göre video önerir, karne
// PDF'inde kırmızı bölge dolar. Bağlamazsan deneme yine çalışır, sadece
// bu zincir devreye girmez.
export function KazanimPanel({ overview }: { overview: ExamOverview }) {
  const { showError, showSuccess } = useToast();
  const [subject, setSubject] = useState(overview.subjects[0]?.subject ?? "");
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);

  const supportsRoentgen = subject in CURRICULUM_TREE;
  const topics = (CURRICULUM_TREE[subject] ?? []).map((t) => ({ topicName: t.name, subtopics: t.subtopics }));

  function loadSummary() {
    if (!subject) return;
    fetch(`/api/exams/${overview.exam.id}/subtopic-summary?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => setSummary(data.summary ?? []))
      .catch(() => setSummary([]));
  }

  useEffect(() => {
    if (!subject) return;
    setLoading(true);
    setSummary(null);
    setTemplates(null);
    fetch(`/api/exams/${overview.exam.id}/answer-key?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => setQuestions(data.questions ?? []))
      .catch(() => showError("Cevap anahtarı yüklenemedi."))
      .finally(() => setLoading(false));
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, overview.exam.id]);

  function update(questionNumber: number, patch: Partial<QuestionRow>) {
    setQuestions((prev) => prev.map((q) => (q.questionNumber === questionNumber ? { ...q, ...patch } : q)));
  }

  async function loadTemplates() {
    setTemplates(null);
    const res = await fetch(`/api/exams/answer-key-templates?subject=${encodeURIComponent(subject)}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setTemplates((data?.templates ?? []).filter((t: Template) => t.examId !== overview.exam.id));
  }

  async function copyFrom(templateExamId: string) {
    try {
      const res = await fetch(`/api/exams/${templateExamId}/answer-key?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      const source: QuestionRow[] = data.questions ?? [];
      if (source.length === 0) throw new Error("O denemede kazanım eşlemesi yok.");
      const byNumber = new Map(source.map((q) => [q.questionNumber, q]));
      // Sadece KAZANIM kopyalanır — doğru cevaplar bu denemeye özeldir,
      // asla başka bir denemeden taşınmaz.
      setQuestions((prev) =>
        prev.map((q) => {
          const src = byNumber.get(q.questionNumber);
          return src ? { ...q, subtopicId: src.subtopicId, subtopicLabel: src.subtopicLabel } : q;
        })
      );
      setTemplates(null);
      showSuccess("Kazanımlar kopyalandı — kaydetmeyi unutma.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kopyalanamadı.");
    }
  }

  async function save() {
    const rows = questions.filter((q) => q.subtopicLabel.trim());
    if (rows.length === 0) return showError("En az bir soruya kazanım ata.");
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${overview.exam.id}/answer-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, questions: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");

      // Kazanım SONRADAN atandıysa Röntgen köprüsü sonuç kaydı sırasında
      // çalışamamıştı — burada yeniden tetikliyoruz (bkz. roentgen-sync).
      const sync = await fetch(`/api/exams/${overview.exam.id}/roentgen-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject }),
      })
        .then((r) => r.json())
        .catch(() => null);

      showSuccess(
        sync?.syncedCount > 0 ? `${data.count} soru kaydedildi · ${sync.syncedCount} öğrenci Röntgen'e işlendi.` : `${data.count} soru kaydedildi.`
      );
      loadSummary();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  const assignedCount = questions.filter((q) => q.subtopicLabel.trim()).length;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-1.5 rounded-xl border border-hairline bg-white/60 px-3 py-2.5 text-[11px] leading-relaxed text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        Bu adım opsiyonel. Soruları kazanımlara bağlarsan sonuçlar Akademik Röntgen&apos;e akar — öğrencinin zayıf konuları güncellenir, Video Ders
        Merkezi ona göre öneri yapar, karne PDF&apos;i dolar.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {overview.subjects.map((s) => (
          <button
            key={s.subject}
            onClick={() => setSubject(s.subject)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition",
              subject === s.subject
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            )}
          >
            {s.subject}
            {!(s.subject in CURRICULUM_TREE) && <span className="text-[9px] opacity-60">konu ağacı yok</span>}
          </button>
        ))}
      </div>

      {!subject ? null : questions.length === 0 && !loading ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-white/40 py-14 text-center dark:border-white/10 dark:bg-white/5">
          <p className="text-xs text-espresso-muted dark:text-cream/40">
            Bu dersin cevap anahtarı henüz girilmemiş — önce &quot;Cevap Anahtarı&quot; adımını tamamla.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-espresso dark:text-cream">
                Soru → Kazanım
                <span className="ml-2 font-normal text-espresso-muted dark:text-cream/40">
                  {assignedCount}/{questions.length} atandı
                </span>
              </p>
              <div className="relative">
                <button
                  onClick={() => (templates === null ? loadTemplates() : setTemplates(null))}
                  className="flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
                >
                  <Copy className="h-3 w-3" /> Önceki denemeden kopyala
                </button>
                {templates !== null && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-60 overflow-hidden rounded-xl border border-hairline bg-white shadow-xl dark:border-white/10 dark:bg-midnight-card">
                    {templates.length === 0 ? (
                      <p className="p-3 text-[11px] text-espresso-muted dark:text-cream/40">Bu derste başka eşleme yok.</p>
                    ) : (
                      templates.map((t) => (
                        <button
                          key={t.examId}
                          onClick={() => copyFrom(t.examId)}
                          className="block w-full truncate px-3 py-2 text-left text-[11px] text-espresso transition hover:bg-cream-card dark:text-cream dark:hover:bg-white/5"
                        >
                          {t.examName}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              </div>
            ) : (
              <div className="max-h-[24rem] space-y-1 overflow-y-auto pr-1">
                {questions.map((q) => (
                  <div key={q.questionNumber} className="flex items-center gap-2">
                    <span className="w-9 shrink-0 text-center text-[10.5px] font-semibold text-espresso-muted dark:text-cream/40">
                      {q.questionNumber}
                      {q.correctAnswer && <span className="ml-0.5 text-emerald-600 dark:text-emerald-400">{q.correctAnswer}</span>}
                    </span>
                    {supportsRoentgen ? (
                      <select
                        value={q.subtopicId ?? ""}
                        onChange={(e) => {
                          const found = topics.flatMap((t) => t.subtopics).find((s) => s.id === e.target.value);
                          update(q.questionNumber, { subtopicId: found ? found.id : null, subtopicLabel: found?.name ?? "" });
                        }}
                        className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
                      >
                        <option value="">Kazanım seç…</option>
                        {topics.map((group) => (
                          <optgroup key={group.topicName} label={group.topicName}>
                            {group.subtopics.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={q.subtopicLabel}
                        onChange={(e) => update(q.questionNumber, { subtopicId: null, subtopicLabel: e.target.value })}
                        placeholder="Konu adı"
                        className="flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-[11px] text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="mt-3 flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet {supportsRoentgen && "ve Röntgen'e İşle"}
            </button>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> En Zayıf Kazanımlar
              </p>
              {summary === null ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                </div>
              ) : summary.length === 0 ? (
                <p className="py-6 text-center text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
                  Kazanımları atayıp kaydettiğinde sınıfın konu bazlı başarısı burada çıkar.
                </p>
              ) : (
                <AnimatePresence mode="popLayout">
                  <div className="space-y-2.5">
                    {summary.map((row) => {
                      const tone = scoreTone(row.averagePercent);
                      return (
                        <motion.div key={row.subtopicId ?? row.subtopicLabel} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-[11px] font-medium text-espresso dark:text-cream">{row.subtopicLabel}</span>
                            <span className={cn("shrink-0 text-[11px] font-bold tabular-nums", tone.text)}>%{row.averagePercent}</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                            <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${row.averagePercent}%` }} />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
