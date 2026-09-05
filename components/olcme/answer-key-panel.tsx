"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, CheckCircle2, Wand2, Copy } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { ExamOverview } from "./types";

type Template = { examId: string; examName: string; examDate: string };

function clean(text: string): string {
  return text.toUpperCase().replace(/[^A-E]/g, "");
}

// Cevap anahtarı — TAMAMEN metin üzerinden (kullanıcı kuralı #3). İki yol
// var ve ikisi de aynı uca (PUT .../answer-key/from-text) gider:
//   1) Toplu yapıştır: tüm derslerin cevapları tek dizi halindeyse,
//      şablondaki soru sayılarına göre OTOMATİK bölünür.
//   2) Ders ders yapıştır.
// Soru sayısı metnin uzunluğundan anlaşılır; ayrıca "kaç soru" diye
// sormayız. Şablon bir uzunluk biliyorsa canlı olarak doğrulanır.
export function AnswerKeyPanel({ overview, onSaved }: { overview: ExamOverview; onSaved: () => void }) {
  const { showError, showSuccess } = useToast();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [copySubject, setCopySubject] = useState<string | null>(null);

  const subjects = overview.subjects;

  // Kayıtlı cevap anahtarlarını metne geri çevirip alanları doldur —
  // yönetici daha önce girdiğini görsün, üstüne yazabilsin.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      subjects.map((s) =>
        fetch(`/api/exams/${overview.exam.id}/answer-key?subject=${encodeURIComponent(s.subject)}`)
          .then((res) => res.json())
          .then((data) => {
            const letters = (data.questions ?? [])
              .slice()
              .sort((a: { questionNumber: number }, b: { questionNumber: number }) => a.questionNumber - b.questionNumber)
              .map((q: { correctAnswer: string | null }) => q.correctAnswer ?? "")
              .join("");
            return [s.subject, letters] as const;
          })
          .catch(() => [s.subject, ""] as const)
      )
    ).then((pairs) => {
      if (cancelled) return;
      setTexts(Object.fromEntries(pairs));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [overview.exam.id, subjects]);

  const expectedTotal = useMemo(() => subjects.reduce((sum, s) => sum + (s.expectedQuestionCount ?? 0), 0), [subjects]);

  function splitBulk() {
    const letters = clean(bulkText);
    if (letters.length === 0) return showError("Önce cevap anahtarı metnini yapıştır.");
    if (subjects.some((s) => !s.expectedQuestionCount)) {
      return showError("Bu denemenin şablonunda soru sayıları tanımlı değil — dersleri tek tek yapıştır.");
    }
    if (letters.length !== expectedTotal) {
      return showError(`Beklenen ${expectedTotal} harf, ${letters.length} harf yapıştırıldı. Bölme yapılmadı.`);
    }
    const next: Record<string, string> = {};
    let cursor = 0;
    for (const s of subjects) {
      const len = s.expectedQuestionCount ?? 0;
      next[s.subject] = letters.slice(cursor, cursor + len);
      cursor += len;
    }
    setTexts(next);
    setBulkText("");
    showSuccess("Dersler ayrıştırıldı — kontrol edip kaydet.");
  }

  async function saveSubject(subject: string, silent = false): Promise<boolean> {
    const text = clean(texts[subject] ?? "");
    if (text.length === 0) return false;
    const res = await fetch(`/api/exams/${overview.exam.id}/answer-key/from-text`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, text }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      showError(`${subject}: ${data?.error ?? "kaydedilemedi."}`);
      return false;
    }
    if (!silent) showSuccess(`${subject} — ${data.questionCount} soru kaydedildi.`);
    return true;
  }

  async function saveAll() {
    const pending = subjects.filter((s) => clean(texts[s.subject] ?? "").length > 0);
    if (pending.length === 0) return showError("Kaydedilecek cevap anahtarı yok.");
    setSavingAll(true);
    let ok = 0;
    for (const s of pending) {
      if (await saveSubject(s.subject, true)) ok++;
    }
    setSavingAll(false);
    if (ok > 0) {
      showSuccess(`${ok} dersin cevap anahtarı kaydedildi.`);
      onSaved();
    }
  }

  async function loadTemplates(subject: string) {
    setCopySubject(subject);
    setTemplates(null);
    const res = await fetch(`/api/exams/answer-key-templates?subject=${encodeURIComponent(subject)}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setTemplates((data?.templates ?? []).filter((t: Template) => t.examId !== overview.exam.id));
  }

  async function copyFrom(templateExamId: string, subject: string) {
    try {
      const res = await fetch(`/api/exams/${templateExamId}/answer-key?subject=${encodeURIComponent(subject)}`);
      const data = await res.json();
      const letters = (data.questions ?? [])
        .slice()
        .sort((a: { questionNumber: number }, b: { questionNumber: number }) => a.questionNumber - b.questionNumber)
        .map((q: { correctAnswer: string | null }) => q.correctAnswer ?? "")
        .join("");
      if (!letters) throw new Error("O denemede bu dersin cevap anahtarı yok.");
      setTexts((prev) => ({ ...prev, [subject]: letters }));
      setCopySubject(null);
      showSuccess("Kopyalandı — kaydetmeyi unutma.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kopyalanamadı.");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toplu yapıştırma — sadece şablon soru sayılarını biliyorsa anlamlı */}
      {expectedTotal > 0 && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
            <Wand2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Tek seferde yapıştır
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
            Tüm derslerin cevapları tek dizi halindeyse buraya yapıştır — şablon sırasına göre otomatik bölünür ({expectedTotal} harf beklenir).
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={2}
            placeholder="ABCDEABCDE…"
            className="mt-2.5 w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2 font-mono text-[10.5px] uppercase leading-relaxed tracking-wide text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className={cn("text-[10.5px] tabular-nums", clean(bulkText).length === expectedTotal ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-espresso-muted dark:text-cream/40")}>
              {clean(bulkText).length} / {expectedTotal} harf
            </span>
            <button
              onClick={splitBulk}
              disabled={clean(bulkText).length === 0}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              Derslere Böl
            </button>
          </div>
        </div>
      )}

      {/* Ders ders */}
      <div className="space-y-2.5">
        {subjects.map((s) => {
          const value = texts[s.subject] ?? "";
          const count = clean(value).length;
          const expected = s.expectedQuestionCount;
          const complete = expected != null ? count === expected : count > 0;
          const saved = s.answeredCount > 0;
          return (
            <div key={s.subject} className="rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                  {s.subject}
                  {saved && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-[10.5px] tabular-nums",
                      count === 0
                        ? "text-espresso-muted dark:text-cream/40"
                        : complete
                          ? "font-semibold text-emerald-700 dark:text-emerald-400"
                          : "font-semibold text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {count}
                    {expected != null ? ` / ${expected}` : ""} soru
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => (copySubject === s.subject ? setCopySubject(null) : loadTemplates(s.subject))}
                      title="Önceki denemeden kopyala"
                      className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[10.5px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    {copySubject === s.subject && (
                      <div className="absolute right-0 top-full z-20 mt-1.5 w-60 overflow-hidden rounded-xl border border-hairline bg-white shadow-xl dark:border-white/10 dark:bg-midnight-card">
                        {templates === null ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                          </div>
                        ) : templates.length === 0 ? (
                          <p className="p-3 text-[11px] text-espresso-muted dark:text-cream/40">Bu derste başka cevap anahtarı yok.</p>
                        ) : (
                          templates.map((t) => (
                            <button
                              key={t.examId}
                              onClick={() => copyFrom(t.examId, s.subject)}
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
              </div>
              <input
                value={value}
                onChange={(e) => setTexts((prev) => ({ ...prev, [s.subject]: e.target.value.toUpperCase() }))}
                placeholder="ABCDEABCDE…"
                className={cn(
                  "w-full rounded-lg border bg-white px-3 py-2 font-mono text-[11px] uppercase tracking-[0.15em] text-espresso outline-none transition dark:bg-midnight dark:text-cream",
                  count > 0 && !complete ? "border-amber-400/50 focus:border-amber-500" : "border-hairline focus:border-emerald-500 dark:border-white/10"
                )}
              />
            </div>
          );
        })}
      </div>

      <button
        onClick={saveAll}
        disabled={savingAll}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
      >
        {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Cevap Anahtarlarını Kaydet
      </button>
    </div>
  );
}
