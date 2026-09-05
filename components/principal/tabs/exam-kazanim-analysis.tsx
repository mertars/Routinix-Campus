"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Save, Copy, Search, CheckCircle2, Sparkles, Target } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { RosterStudent } from "@/lib/exam-import/types";

type Exam = { id: string; name: string; examDate: string };
type SubjectRow = { subject: string; supportsRoentgenBridge: boolean };
type AnswerKeyRow = { questionNumber: number; subtopicId: string | null; subtopicLabel: string };
type Template = { examId: string; examName: string; examDate: string };

function subtopicOptions(subject: string) {
  return (CURRICULUM_TREE[subject] ?? []).map((topic) => ({ topicName: topic.name, subtopics: topic.subtopics }));
}

function parseNumberList(text: string): number[] {
  return [...new Set(text.split(/[,\s]+/).map((t) => Number(t.trim())).filter((n) => Number.isInteger(n) && n > 0))];
}

// Kullanıcı talebi (2026-09-05) — "Ölçme Değerlendirme... hepsi birbirini
// besleyen modüller zinciri olacak". Bu ekran, mevcut Exam/ExamNetResult
// sistemine (ders bazlı net) SONRADAN kazanım kırılımı eklemek için ayrı
// ve basit tutuldu — ana içe aktarma sihirbazını (exam-results-import.tsx)
// karmaşıklaştırmadan: 1) bir sınav+ders için "cevap anahtarı" (hangi soru
// hangi kazanıma ait) tanımlanır, 2) her öğrencinin o sınav+dersteki
// yanlış/boş soru NUMARALARI girilir. İkisi birleşince Matematik/Fizik'te
// otomatik olarak Akademik Röntgen'e (TopicMasteryAssessment) yazılır —
// bkz. lib/server/exams/subtopic-breakdown.ts — bundan sonra Video Ders
// Merkezi'nin "Röntgen Önerileri" motoru bu veriyi SIFIR EK KOD ile yakalar.
export function ExamKazanimAnalysisTab() {
  const { showError, showSuccess } = useToast();

  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subject, setSubject] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [questionCount, setQuestionCount] = useState(40);
  const [answerKey, setAnswerKey] = useState<AnswerKeyRow[]>([]);
  const [loadingKey, setLoadingKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [templates, setTemplates] = useState<Template[] | null>(null);

  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [rosterQuery, setRosterQuery] = useState("");
  const [wrongInputs, setWrongInputs] = useState<Record<string, string>>({});
  const [blankInputs, setBlankInputs] = useState<Record<string, string>>({});
  const [savingDetail, setSavingDetail] = useState(false);
  const [detailResult, setDetailResult] = useState<{ successCount: number; skippedCount: number } | null>(null);

  const supportsRoentgenBridge = subject in CURRICULUM_TREE;

  useEffect(() => {
    fetch("/api/exams")
      .then((res) => res.json())
      .then((data) => setExams(data.exams ?? []))
      .catch(() => showError("Sınav listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSubject("");
    setSubjects([]);
    setAnswerKey([]);
    setRoster(null);
    setDetailResult(null);
    if (!examId) return;
    fetch(`/api/exams/${examId}/subjects`)
      .then((res) => res.json())
      .then((data) => setSubjects(data.subjects ?? []))
      .catch(() => showError("Dersler yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  useEffect(() => {
    setAnswerKey([]);
    setDetailResult(null);
    setWrongInputs({});
    setBlankInputs({});
    if (!examId || !subject) return;
    setLoadingKey(true);
    fetch(`/api/exams/${examId}/answer-key?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.questions?.length > 0) {
          setAnswerKey(data.questions);
          setQuestionCount(Math.max(...data.questions.map((q: AnswerKeyRow) => q.questionNumber)));
        }
      })
      .catch(() => showError("Cevap anahtarı yüklenemedi."))
      .finally(() => setLoadingKey(false));
    fetch(`/api/exams/${examId}/roster`)
      .then((res) => res.json())
      .then((data) => setRoster(data.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, subject]);

  function ensureAnswerKeyLength(count: number) {
    setAnswerKey((prev) => {
      const byNumber = new Map(prev.map((r) => [r.questionNumber, r]));
      return Array.from({ length: count }, (_, i) => byNumber.get(i + 1) ?? { questionNumber: i + 1, subtopicId: null, subtopicLabel: "" });
    });
  }

  function updateAnswerKeyRow(questionNumber: number, patch: Partial<AnswerKeyRow>) {
    setAnswerKey((prev) => prev.map((r) => (r.questionNumber === questionNumber ? { ...r, ...patch } : r)));
  }

  async function loadTemplates() {
    if (!subject) return;
    const res = await fetch(`/api/exams/answer-key-templates?subject=${encodeURIComponent(subject)}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setTemplates((data?.templates ?? []).filter((t: Template) => t.examId !== examId));
  }

  async function copyFromTemplate(templateExamId: string) {
    try {
      const res = await fetch(`/api/exams/${templateExamId}/answer-key?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      if (!res.ok || !data.questions?.length) throw new Error("Bu sınavda cevap anahtarı bulunamadı.");
      setAnswerKey(data.questions);
      setQuestionCount(Math.max(...data.questions.map((q: AnswerKeyRow) => q.questionNumber)));
      setTemplates(null);
      showSuccess("Cevap anahtarı kopyalandı — kaydetmeyi unutma.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kopyalanamadı.");
    }
  }

  async function saveAnswerKey() {
    const rows = answerKey.filter((r) => r.subtopicLabel.trim());
    if (rows.length === 0) {
      showError("En az bir soruya kazanım ata.");
      return;
    }
    setSavingKey(true);
    try {
      const res = await fetch(`/api/exams/${examId}/answer-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, questions: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess(`Cevap anahtarı kaydedildi (${data.count} soru).`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSavingKey(false);
    }
  }

  const filteredRoster = useMemo(() => {
    if (!roster) return [];
    const q = rosterQuery.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => `${s.firstName} ${s.lastName} ${s.branchName}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [roster, rosterQuery]);

  async function saveStudentDetails() {
    const rows = (roster ?? [])
      .map((s) => ({
        studentId: s.id,
        wrongQuestionNumbers: parseNumberList(wrongInputs[s.id] ?? ""),
        blankQuestionNumbers: parseNumberList(blankInputs[s.id] ?? ""),
      }))
      .filter((r) => r.wrongQuestionNumbers.length > 0 || r.blankQuestionNumbers.length > 0);
    if (rows.length === 0) {
      showError("En az bir öğrenci için yanlış/boş soru gir.");
      return;
    }
    setSavingDetail(true);
    try {
      const res = await fetch(`/api/exams/${examId}/net-results/kazanim-detail`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      setDetailResult({ successCount: data.successCount, skippedCount: data.skippedCount });
      showSuccess(`${data.successCount} öğrencinin kazanım kırılımı hesaplandı.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSavingDetail(false);
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Target className="h-4 w-4 text-brand-600 dark:text-brand-400" /> Kazanım Bazlı Deneme Analizi
      </h2>
      <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
        Net girilmiş bir sınav+dersin kazanım kırılımını ekle — Matematik/Fizik&apos;te bu, Akademik Röntgen&apos;i ve dolayısıyla Video Ders Merkezi&apos;nin
        önerilerini otomatik besler.
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso-muted dark:text-cream/40">Sınav</label>
          <select
            value={examId}
            onChange={(e) => setExamId(e.target.value)}
            className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            <option value="">Seçin…</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso-muted dark:text-cream/40">Ders</label>
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={!examId || loadingSubjects}
            className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 disabled:opacity-50 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            <option value="">
              {examId ? (subjects.length === 0 ? "Bu sınavda net girilmemiş" : "Seçin…") : "Önce sınav seçin"}
            </option>
            {subjects.map((s) => (
              <option key={s.subject} value={s.subject}>
                {s.subject}
                {s.supportsRoentgenBridge ? "" : " (sadece analiz — Röntgen'e yazılmaz)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {subject && (
        <div className="space-y-5">
          {supportsRoentgenBridge ? (
            <p className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" /> Bu ders için kazanım kırılımı Akademik Röntgen&apos;e otomatik yazılacak.
            </p>
          ) : (
            <p className="rounded-xl border border-hairline bg-cream-card px-3 py-2 text-[11px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
              Bu derste Röntgen&apos;in henüz konu kırılımı yok — kazanım analizi yine hesaplanır ve karnede gösterilir, sadece Röntgen&apos;e yazılmaz.
            </p>
          )}

          {/* Cevap Anahtarı */}
          <div className="rounded-2xl border border-hairline p-4 dark:border-white/10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-espresso dark:text-cream">1. Cevap Anahtarı — Soru → Kazanım</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  onBlur={() => ensureAnswerKeyLength(questionCount)}
                  className="w-16 rounded-lg border border-hairline bg-white px-2 py-1 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                />
                <button
                  onClick={() => ensureAnswerKeyLength(questionCount)}
                  className="rounded-lg border border-hairline px-2.5 py-1 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                >
                  Soru Sayısını Uygula
                </button>
                <div className="relative">
                  <button
                    onClick={loadTemplates}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-500/25 bg-brand-500/5 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-500/10 dark:border-brand-400/20 dark:text-brand-300"
                  >
                    <Copy className="h-3 w-3" /> Önceki Sınavdan Kopyala
                  </button>
                  {templates !== null && (
                    <div className="absolute right-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-xl border border-hairline bg-white shadow-xl dark:border-white/10 dark:bg-midnight-card">
                      {templates.length === 0 ? (
                        <p className="p-3 text-[11px] text-espresso-muted dark:text-cream/40">Bu ders için başka cevap anahtarı yok.</p>
                      ) : (
                        templates.map((t) => (
                          <button
                            key={t.examId}
                            onClick={() => copyFromTemplate(t.examId)}
                            className="block w-full truncate px-3 py-2 text-left text-[11px] text-espresso transition hover:bg-cream-card dark:text-cream dark:hover:bg-white/5"
                          >
                            {t.examName} · {new Date(t.examDate).toLocaleDateString("tr-TR")}
                          </button>
                        ))
                      )}
                      <button onClick={() => setTemplates(null)} className="block w-full border-t border-hairline px-3 py-1.5 text-center text-[10px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
                        Kapat
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {loadingKey ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              </div>
            ) : answerKey.length === 0 ? (
              <p className="py-4 text-center text-[11px] text-espresso-muted dark:text-cream/40">Soru sayısını girip &quot;Uygula&quot;ya bas.</p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {answerKey.map((row) => (
                  <div key={row.questionNumber} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-center text-[11px] font-semibold text-espresso-muted dark:text-cream/40">#{row.questionNumber}</span>
                    {supportsRoentgenBridge ? (
                      <select
                        value={row.subtopicId ?? `label:${row.subtopicLabel}`}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.startsWith("label:")) {
                            updateAnswerKeyRow(row.questionNumber, { subtopicId: null, subtopicLabel: value.slice(6) });
                          } else {
                            const found = subtopicOptions(subject)
                              .flatMap((t) => t.subtopics)
                              .find((s) => s.id === value);
                            updateAnswerKeyRow(row.questionNumber, { subtopicId: value, subtopicLabel: found?.name ?? "" });
                          }
                        }}
                        className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                      >
                        <option value="label:">Seçin…</option>
                        {subtopicOptions(subject).map((group) => (
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
                        value={row.subtopicLabel}
                        onChange={(e) => updateAnswerKeyRow(row.questionNumber, { subtopicId: null, subtopicLabel: e.target.value })}
                        placeholder="Konu adı (örn. Osmanlı Tarihi)"
                        className="flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-[11px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={saveAnswerKey}
              disabled={savingKey || answerKey.length === 0}
              className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-espresso text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Cevap Anahtarını Kaydet
            </button>
          </div>

          {/* Öğrenci bazlı yanlış/boş girişi */}
          <div className="rounded-2xl border border-hairline p-4 dark:border-white/10">
            <p className="mb-3 text-xs font-semibold text-espresso dark:text-cream">2. Öğrenci Bazlı Yanlış / Boş Sorular</p>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
              <input
                value={rosterQuery}
                onChange={(e) => setRosterQuery(e.target.value)}
                placeholder="Öğrenci veya şube ara..."
                className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
            </div>
            {!roster ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              </div>
            ) : (
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {filteredRoster.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 rounded-lg bg-cream-card px-2.5 py-1.5 dark:bg-white/5">
                    <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-espresso dark:text-cream">
                      {s.firstName} {s.lastName} <span className="font-normal text-espresso-muted dark:text-cream/40">· {s.branchName}</span>
                    </span>
                    <input
                      value={wrongInputs[s.id] ?? ""}
                      onChange={(e) => setWrongInputs((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Yanlışlar: 3,7,12"
                      className="w-32 shrink-0 rounded-lg border border-rose-400/25 bg-white px-2 py-1 text-[10.5px] text-espresso outline-none focus:border-rose-500 dark:border-rose-400/20 dark:bg-midnight dark:text-cream"
                    />
                    <input
                      value={blankInputs[s.id] ?? ""}
                      onChange={(e) => setBlankInputs((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Boşlar: 5,9"
                      className="w-28 shrink-0 rounded-lg border border-hairline bg-white px-2 py-1 text-[10.5px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    />
                  </div>
                ))}
              </div>
            )}

            {detailResult && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> {detailResult.successCount} öğrenci hesaplandı
                {detailResult.skippedCount > 0 ? `, ${detailResult.skippedCount} öğrenci atlandı (net girilmemiş).` : "."}
              </p>
            )}

            <button
              onClick={saveStudentDetails}
              disabled={savingDetail || !roster}
              className={cn(
                "mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-espresso text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              )}
            >
              {savingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kazanım Kırılımını Hesapla ve Kaydet
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
