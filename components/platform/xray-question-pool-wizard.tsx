"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Loader2, ArrowRight, ArrowLeft, Download, X, Database } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { CURRICULUM_TREE, XRAY_SUBJECTS, XRAY_MIN_GRADE } from "@/lib/mock-data";
import { validateQuestions } from "@/lib/xray-question-import/validate";
import type { RawQuestion, ValidatedQuestion } from "@/lib/xray-question-import/types";

const STEPS = ["Ders & JSON", "Doğrulama", "Yükleme Sonucu"];

const EXAMPLE_JSON = {
  konu: "12. Sınıf - Belirsiz İntegral",
  test_adi: "Test 3: Kuvvet Kuralı Uygulamaları",
  sorular: [
    {
      soruNo: 1,
      kazanimId: "INTEGRAL_KUVVET_KURALI",
      questionText: "∫x^4 dx integralinin sonucunu bulunuz.",
      finalAnswer: "x^5/5 + C",
      detailedSolution: "Kuvvet kuralına göre üs 1 artırılır, yeni üse bölünür.",
      diagnosticComment: "Öğrenci bu soruda zorlandıysa: kuvvet kuralı eksiktir.",
    },
  ],
};

type RowResult = { rowIndex: number; label: string; status: "success" | "failed"; error?: string };

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-5 flex items-center">
      {STEPS.map((label, index) => {
        const stepNum = index + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        return (
          <div key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  isDone ? "bg-green-600 text-white" : isActive ? "bg-espresso text-cream dark:bg-brand-600" : "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/40"
                )}
              >
                {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : stepNum}
              </motion.div>
              <span className={cn("max-w-[76px] text-center text-[9px] leading-tight", isActive ? "font-semibold text-espresso dark:text-cream" : "text-espresso-muted dark:text-cream/40")}>
                {label}
              </span>
            </div>
            {stepNum < STEPS.length && <div className={cn("mx-1 h-0.5 flex-1 rounded-full transition-colors", isDone ? "bg-green-600" : "bg-cream-card dark:bg-white/10")} />}
          </div>
        );
      })}
    </div>
  );
}

// Faz X — "Toplu İçe Aktarma Sihirbazı"nın (bkz. components/principal/
// user-management/bulk-import-wizard.tsx) AYNI adım/önizleme deseni,
// Akademik Röntgen'in Test 1 soru havuzuna uyarlandı: X Geçerli/Y Hatalı
// önizleme → onay → X Başarılı/Y Başarısız sonuç. Soru havuzu KURUM BAZLI
// DEĞİL (bkz. upload route'undaki şema notu) — bu yüzden platform sahibi
// panelinde, kurum seçimi OLMADAN yaşıyor.
export function XrayQuestionPoolWizard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [step, setStep] = useState(1);
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [subtopicId, setSubtopicId] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [testAdi, setTestAdi] = useState("");
  const [validatedRows, setValidatedRows] = useState<ValidatedQuestion[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);

  const subtopicOptions = (CURRICULUM_TREE[subject] ?? []).filter((t) => t.grade >= XRAY_MIN_GRADE).flatMap((t) => t.subtopics);

  function reset() {
    setStep(1);
    setJsonText("");
    setTestAdi("");
    setValidatedRows([]);
    setResults(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function downloadExample() {
    const blob = new Blob([JSON.stringify(EXAMPLE_JSON, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ornek-soru-havuzu.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleValidate() {
    if (!subtopicId) {
      showError("Önce bir konu seç.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      showError("Geçerli bir JSON değil — söz dizimini kontrol et.");
      return;
    }
    const obj = parsed as { test_adi?: string; sorular?: RawQuestion[] };
    if (!obj.test_adi?.trim()) {
      showError('JSON içinde "test_adi" alanı eksik veya boş.');
      return;
    }
    if (!Array.isArray(obj.sorular) || obj.sorular.length === 0) {
      showError('JSON içindeki "sorular" dizisi boş veya eksik.');
      return;
    }
    setTestAdi(obj.test_adi);
    setValidatedRows(validateQuestions(obj.sorular));
    setStep(2);
  }

  const validCount = validatedRows.filter((r) => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  async function handleImport() {
    const validRawRows = validatedRows.filter((r) => r.isValid).map((r) => r.raw);
    if (validRawRows.length === 0) return;
    setIsUploading(true);
    setStep(3);
    try {
      const res = await fetch("/api/xray/practice-questions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subtopicId, test_adi: testAdi, sorular: validRawRows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Yükleme başarısız.");
      setResults(data.results ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Yükleme başarısız.");
      setStep(2);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Akademik Röntgen — Soru Havuzu Yükle" variant="center" widthClassName="max-w-lg">
      <StepIndicator current={step} />

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={subject}
                onChange={(event) => {
                  setSubject(event.target.value);
                  setSubtopicId("");
                }}
                className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
              >
                {XRAY_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={subtopicId}
                onChange={(event) => setSubtopicId(event.target.value)}
                disabled={subtopicOptions.length === 0}
                className="min-w-[160px] flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
              >
                <option value="">Konu seç...</option>
                {subtopicOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/50">
              Seçtiğin konu, sorunun PUANLAMADA kullanılacağı gerçek konudur — JSON içindeki &quot;konu&quot; alanı sadece etiket, eşleşmesi gerekmez.
              &quot;test_adi&quot; her yüklemede benzersiz olmalı: aynı isimle tekrar yüklersen o yüklemenin YERİNE geçer, farklı isimle yüklersen havuza
              EKLENİR.
            </p>
            <button onClick={downloadExample} className="flex items-center gap-1.5 text-xs font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-400">
              <Download className="h-3.5 w-3.5" /> Örnek JSON İndir
            </button>
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              placeholder='{ "konu": "...", "test_adi": "...", "sorular": [...] }'
              rows={10}
              spellCheck={false}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2.5 font-mono text-[11px] leading-relaxed text-espresso outline-none focus:border-brand-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
            <button
              onClick={handleValidate}
              disabled={!jsonText.trim()}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              Devam Et <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-500/10">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{validCount}</p>
                <p className="text-[10px] text-green-700/70 dark:text-green-400/70">Geçerli Soru</p>
              </div>
              <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{invalidCount}</p>
                <p className="text-[10px] text-rose-600/70 dark:text-rose-300/70">Hatalı Soru</p>
              </div>
            </div>

            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-hairline p-2 dark:border-white/10">
              {validatedRows.map((row) => (
                <div
                  key={row.rowIndex}
                  className={cn("flex items-start gap-2 rounded-lg px-2.5 py-2 text-xs", row.isValid ? "bg-green-50 dark:bg-green-500/10" : "bg-rose-50 dark:bg-rose-500/10")}
                >
                  {row.isValid ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  <div className="min-w-0">
                    <p className="font-medium text-espresso dark:text-cream">{row.label}</p>
                    {!row.isValid && <p className="text-rose-600 dark:text-rose-300">{row.errors.join(" · ")}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep(1)}
                className="flex min-h-[48px] items-center gap-1.5 rounded-2xl border border-hairline px-4 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Geri
              </button>
              <button
                onClick={handleImport}
                disabled={validCount === 0}
                className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                Geçerli {validCount} Soruyu Yükle <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-4">
            {isUploading || !results ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                <p className="text-sm text-espresso-muted dark:text-cream/40">Sorular havuza yazılıyor...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl bg-green-50 p-3 text-center dark:bg-green-500/10">
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{results.filter((r) => r.status === "success").length}</p>
                    <p className="text-[10px] text-green-700/70 dark:text-green-400/70">Başarıyla Eklendi</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3 text-center dark:bg-rose-500/10">
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-300">{results.filter((r) => r.status === "failed").length}</p>
                    <p className="text-[10px] text-rose-600/70 dark:text-rose-300/70">Başarısız</p>
                  </div>
                </div>

                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-hairline p-2 dark:border-white/10">
                  {results.map((r) => (
                    <div
                      key={r.rowIndex}
                      className={cn("flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs", r.status === "success" ? "bg-green-50 dark:bg-green-500/10" : "bg-rose-50 dark:bg-rose-500/10")}
                    >
                      <span className="min-w-0 truncate font-medium text-espresso dark:text-cream">{r.label}</span>
                      {r.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-600" />
                      ) : (
                        <span className="shrink-0 text-[10px] text-rose-600 dark:text-rose-300">{r.error}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 rounded-xl bg-sky-50 px-3 py-2 text-[11px] text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
                  <Database className="h-3.5 w-3.5 shrink-0" /> Sorular anında havuza eklendi — yeni test atamaları hemen kullanabilir.
                </div>

                <button
                  onClick={handleClose}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  <X className="h-4 w-4" /> Kapat
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
}
