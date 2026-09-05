"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Save, Copy, Search, CheckCircle2, Sparkles, Target, FileBarChart, ChevronRight, BarChart3 } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import type { RosterStudent } from "@/lib/exam-import/types";
import { OpticalUploadSection } from "./optical-upload-section";

type Exam = { id: string; name: string; examDate: string };
type SubjectRow = { subject: string; supportsRoentgenBridge: boolean; hasAnswerKey: boolean };
type AnswerKeyRow = { questionNumber: number; subtopicId: string | null; subtopicLabel: string; correctAnswer: string | null };
type Template = { examId: string; examName: string; examDate: string };
type SummaryRow = { subtopicId: string | null; subtopicLabel: string; averagePercent: number; studentCount: number };

function subtopicOptions(subject: string) {
  return (CURRICULUM_TREE[subject] ?? []).map((topic) => ({ topicName: topic.name, subtopics: topic.subtopics }));
}

function parseNumberList(text: string): number[] {
  return [...new Set(text.split(/[,\s]+/).map((t) => Number(t.trim())).filter((n) => Number.isInteger(n) && n > 0))];
}

function scoreTone(percent: number) {
  if (percent < 30) return { bar: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" };
  if (percent < 60) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" };
  return { bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" };
}

// Ölçme Değerlendirme — Hub'daki 3. modül (2026-09-05). Kullanıcı talebi:
// "bu sistem ERP'de değil, Hub'taki Ölçme Değerlendirme'de olacak, detaylı
// güzel bir ekran yapacağız". ERP'deki eski basit sekmenin (kaldırıldı)
// yerine: soldan sınav seç → ders sekmesi seç → cevap anahtarı + öğrenci
// yanlış/boş girişi → sağda CANLI güncellenen "en zayıf kazanımlar"
// özeti (xray-institution-insights.tsx'teki AYNI sıralı-liste + ilerleme
// çubuğu deseni, tutarlılık için). Backend (lib/server/exams/
// subtopic-breakdown.ts, /api/exams/... uçları) ERP'nin sınav/net sistemiyle
// PAYLAŞILIYOR — sadece "kazanım katmanı" burada yaşıyor, "sınav oluştur +
// net gir" hâlâ ERP > Sınav & Optik Yükleme'de.
export function OlcmePanel() {
  const { showError, showSuccess } = useToast();

  const [exams, setExams] = useState<Exam[] | null>(null);
  const [examId, setExamId] = useState("");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subject, setSubject] = useState("");

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

  const [summary, setSummary] = useState<SummaryRow[] | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [newSubjectName, setNewSubjectName] = useState("");

  const supportsRoentgenBridge = subject in CURRICULUM_TREE;
  const selectedExam = exams?.find((e) => e.id === examId) ?? null;

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
    if (!examId) return;
    fetch(`/api/exams/${examId}/subjects`)
      .then((res) => res.json())
      .then((data) => setSubjects(data.subjects ?? []))
      .catch(() => showError("Dersler yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  function loadSummary() {
    if (!examId || !subject) return;
    setLoadingSummary(true);
    fetch(`/api/exams/${examId}/subtopic-summary?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => setSummary(data.summary ?? []))
      .catch(() => setSummary([]))
      .finally(() => setLoadingSummary(false));
  }

  useEffect(() => {
    setAnswerKey([]);
    setDetailResult(null);
    setWrongInputs({});
    setBlankInputs({});
    setSummary(null);
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
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId, subject]);

  function ensureAnswerKeyLength(count: number) {
    setAnswerKey((prev) => {
      const byNumber = new Map(prev.map((r) => [r.questionNumber, r]));
      return Array.from({ length: count }, (_, i) => byNumber.get(i + 1) ?? { questionNumber: i + 1, subtopicId: null, subtopicLabel: "", correctAnswer: null });
    });
  }

  function updateAnswerKeyRow(questionNumber: number, patch: Partial<AnswerKeyRow>) {
    setAnswerKey((prev) => prev.map((r) => (r.questionNumber === questionNumber ? { ...r, ...patch } : r)));
  }

  // "Ders" listesi SADECE zaten net girilmiş/cevap anahtarı olan dersleri
  // gösterir (bkz. /api/exams/[id]/subjects) — sıfırdan bir sınava optik
  // okuma/cevap anahtarı ile başlamak isteyen bir yönetici için, henüz
  // hiçbir veri yokken de yeni bir ders EKLEYEBİLMESİ gerekir (aksi halde
  // "ders yok, devam edemiyorum" çıkmazına düşer — 2026-09-05 düzeltmesi).
  function addSubject() {
    const name = newSubjectName.trim();
    if (!name) return;
    if (!subjects.some((s) => s.subject === name)) {
      setSubjects((prev) => [...prev, { subject: name, supportsRoentgenBridge: name in CURRICULUM_TREE, hasAnswerKey: false }]);
    }
    setSubject(name);
    setNewSubjectName("");
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
      setSubjects((prev) => prev.map((s) => (s.subject === subject ? { ...s, hasAnswerKey: true } : s)));
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
      loadSummary();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSavingDetail(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-10">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-bold text-espresso dark:text-cream">
          <FileBarChart className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Ölçme Değerlendirme
        </h1>
        <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">
          Deneme sonuçlarını kazanım bazlı analiz et — Matematik/Fizik&apos;te bu, Akademik Röntgen&apos;i ve Video Ders Merkezi&apos;nin önerilerini otomatik besler.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        {/* SOL — sınav listesi */}
        <aside className="space-y-1.5 lg:sticky lg:top-20 lg:self-start">
          <p className="mb-1 px-1 text-[10.5px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Sınavlar</p>
          {exams === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : exams.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-hairline bg-white/40 px-3 py-6 text-center text-[11px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
              Henüz sınav yok — ERP &gt; Sınav &amp; Optik Yükleme&apos;den oluştur.
            </p>
          ) : (
            exams.map((exam) => (
              <button
                key={exam.id}
                onClick={() => setExamId(exam.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                  examId === exam.id
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                    : "border-hairline bg-white/60 text-espresso hover:border-emerald-400/30 hover:bg-emerald-500/5 dark:border-white/10 dark:bg-white/5 dark:text-cream"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{exam.name}</span>
                  <span className="block text-[10px] text-espresso-muted dark:text-cream/40">{new Date(exam.examDate).toLocaleDateString("tr-TR")}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            ))
          )}
        </aside>

        {/* SAĞ — ders sekmeleri + çalışma alanı */}
        <main className="min-w-0">
          {!examId ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-20 text-center dark:border-white/10 dark:bg-white/5">
              <Target className="h-6 w-6 text-espresso-muted dark:text-cream/30" />
              <p className="text-xs text-espresso-muted dark:text-cream/40">Soldan bir sınav seç.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-1.5">
                {subjects.map((s) => (
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
                    {s.hasAnswerKey && <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSubject()}
                    placeholder="Yeni ders adı (örn. Matematik)"
                    className="w-44 rounded-full border border-dashed border-hairline bg-white px-3 py-1.5 text-[11.5px] text-espresso outline-none focus:border-emerald-600 dark:border-white/15 dark:bg-midnight dark:text-cream"
                  />
                  <button
                    onClick={addSubject}
                    className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 text-[11.5px] font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    + Ekle
                  </button>
                </div>
              </div>

              {!subject ? (
                subjects.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-20 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs text-espresso-muted dark:text-cream/40">
                      &quot;{selectedExam?.name}&quot; için henüz ders yok — yukarıdan yeni bir ders ekle (cevap anahtarı ve optik okuma buradan başlar), ya
                      da ERP &gt; Sınav &amp; Optik Yükleme&apos;den elle net gir.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline bg-white/40 py-20 text-center dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs text-espresso-muted dark:text-cream/40">Bir ders seç.</p>
                  </div>
                )
              ) : (
                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="min-w-0 space-y-4">
                    {supportsRoentgenBridge ? (
                      <p className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5 shrink-0" /> Bu ders için kazanım kırılımı Akademik Röntgen&apos;e otomatik yazılacak.
                      </p>
                    ) : (
                      <p className="rounded-xl border border-hairline bg-cream-card px-3 py-2 text-[11px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
                        Bu derste Röntgen&apos;in henüz konu kırılımı yok — kazanım analizi yine hesaplanır, sadece Röntgen&apos;e yazılmaz.
                      </p>
                    )}

                    {/* Cevap Anahtarı */}
                    <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
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
                            className="w-16 rounded-lg border border-hairline bg-white px-2 py-1 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                          />
                          <button
                            onClick={() => ensureAnswerKeyLength(questionCount)}
                            className="rounded-lg border border-hairline px-2.5 py-1 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                          >
                            Uygula
                          </button>
                          <div className="relative">
                            <button
                              onClick={loadTemplates}
                              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300"
                            >
                              <Copy className="h-3 w-3" /> Kopyala
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
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
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
                                  className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
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
                                  className="flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                                />
                              )}
                              <input
                                value={row.correctAnswer ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value.trim().toUpperCase().slice(-1);
                                  updateAnswerKeyRow(row.questionNumber, { correctAnswer: /^[A-E]$/.test(v) ? v : null });
                                }}
                                placeholder="D.C."
                                maxLength={1}
                                title="Doğru cevap (A-E) — optik okuma için gerekli"
                                className="w-11 shrink-0 rounded-lg border border-hairline bg-white px-1.5 py-1.5 text-center text-[11px] font-semibold uppercase text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={saveAnswerKey}
                        disabled={savingKey || answerKey.length === 0}
                        className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {savingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Cevap Anahtarını Kaydet
                      </button>
                    </div>

                    {/* Öğrenci bazlı yanlış/boş girişi */}
                    <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
                      <p className="mb-3 text-xs font-semibold text-espresso dark:text-cream">2. Öğrenci Bazlı Yanlış / Boş Sorular</p>
                      <div className="relative mb-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
                        <input
                          value={rosterQuery}
                          onChange={(e) => setRosterQuery(e.target.value)}
                          placeholder="Öğrenci veya şube ara..."
                          className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                        />
                      </div>
                      {!roster ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
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
                                className="w-28 shrink-0 rounded-lg border border-hairline bg-white px-2 py-1 text-[10.5px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
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
                        className="mt-3 flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {savingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Kazanım Kırılımını Hesapla ve Kaydet
                      </button>
                    </div>

                    {/* Optik (OMR tarayıcı) yükleme */}
                    <OpticalUploadSection examId={examId} subject={subject} roster={roster} onSaved={loadSummary} />
                  </div>

                  {/* SAĞ — canlı kazanım özeti */}
                  <div className="lg:sticky lg:top-20 lg:self-start">
                    <div className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                        <BarChart3 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> En Zayıf Kazanımlar
                      </p>
                      {loadingSummary ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                        </div>
                      ) : !summary || summary.length === 0 ? (
                        <p className="py-6 text-center text-[11px] text-espresso-muted dark:text-cream/40">Henüz öğrenci verisi girilmedi.</p>
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
                                  <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">{row.studentCount} öğrenci</p>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
}
