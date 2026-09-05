"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, ChevronRight, ChevronLeft, ScanLine, Sparkles, PartyPopper } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { OpticalFormatForm } from "./optical-format-form";
import type { OpticalFormat } from "./optical-format-manager";

type TemplatePreset = { label: string; suggestedSubjects: string[] };

// Kullanıcı talebi: hazır şablonlar (TYT, AYT Sayısal, AYT Sözel, Sınıf
// Seviye Değerlendirme Lise/Ortaokul) + "Farklı" seçeneği. AYT Eşit
// Ağırlık listede YOKTU ama gerçek bir YKS kategorisi olduğu ve kullanıcı
// "eksik olmasın, artıları ekleyebilirsin" dediği için eklendi.
const TEMPLATE_PRESETS: TemplatePreset[] = [
  { label: "TYT", suggestedSubjects: ["Türkçe", "Sosyal Bilimler", "Temel Matematik", "Fen Bilimleri"] },
  { label: "AYT Sayısal", suggestedSubjects: ["Matematik", "Fizik", "Kimya", "Biyoloji"] },
  { label: "AYT Eşit Ağırlık", suggestedSubjects: ["Matematik", "Edebiyat", "Tarih-1", "Coğrafya-1"] },
  { label: "AYT Sözel", suggestedSubjects: ["Edebiyat-Coğrafya", "Tarih-2", "Coğrafya-2", "Felsefe Grubu"] },
  { label: "Sınıf Seviye Değerlendirme (Lise)", suggestedSubjects: ["Türkçe", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya"] },
  { label: "Sınıf Seviye Değerlendirme (Ortaokul)", suggestedSubjects: ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce"] },
];

type Step = "template" | "template-builder" | "exam-info" | "answer-keys" | "done";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// "Yeni Deneme Oluştur" sihirbazı (2026-09-05) — kullanıcı geri bildirimi:
// Ölçme Değerlendirme panelinde sınav EKLEME imkânı hiç yoktu (sadece ERP'de
// oluşturulmuş sınavlar listeleniyordu, "eski deneme" hissi veriyordu).
// Şimdi tek akışta: (1) hazır şablon seç ya da ilk kez o türden bir sınav
// için şablonu (dersler + optik sütun tanımı, bkz. OpticalFormatForm) BİR
// KEZ oluştur, (2) deneme adı/tarihi gir → sınav oluşturulur, şablonun
// ders listesi otomatik ExamSubject olarak eklenir, (3) her ders için cevap
// anahtarını METİN olarak yapıştır (soru sayısı METNİN uzunluğundan
// otomatik anlaşılır) → "Kaydet" her ders için ayrı ayrı doğrular ve şık
// bir önizleme (harfler rozet olarak) gösterir. PDF tasarımı kapsam dışı
// (kullanıcı ayrıca istedi, sonraya bırakıldı).
export function NewExamWizard({ isOpen, onClose, onFinished }: { isOpen: boolean; onClose: () => void; onFinished: (examId: string) => void }) {
  const { showError, showSuccess } = useToast();
  const [step, setStep] = useState<Step>("template");
  const [formats, setFormats] = useState<OpticalFormat[] | null>(null);
  const [builderPreset, setBuilderPreset] = useState<TemplatePreset | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<OpticalFormat | null>(null);

  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(todayIso());
  const [creatingExam, setCreatingExam] = useState(false);
  const [createdExamId, setCreatedExamId] = useState<string | null>(null);

  const [answerTexts, setAnswerTexts] = useState<Record<string, string>>({});
  const [savingSubject, setSavingSubject] = useState<string | null>(null);
  const [savedSubjects, setSavedSubjects] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setStep("template");
    setBuilderPreset(null);
    setSelectedFormat(null);
    setExamName("");
    setExamDate(todayIso());
    setCreatedExamId(null);
    setAnswerTexts({});
    setSavedSubjects({});
    fetch("/api/optical-formats")
      .then((res) => res.json())
      .then((data) => setFormats(data.formats ?? []))
      .catch(() => showError("Şablonlar yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function formatFor(label: string): OpticalFormat | undefined {
    return formats?.find((f) => f.name === label);
  }

  function pickPreset(preset: TemplatePreset) {
    const existing = formatFor(preset.label);
    if (existing) {
      setSelectedFormat(existing);
      setExamName(`${preset.label} — ${new Date().toLocaleDateString("tr-TR")}`);
      setStep("exam-info");
    } else {
      setBuilderPreset(preset);
      setStep("template-builder");
    }
  }

  function pickCustom() {
    setBuilderPreset({ label: "", suggestedSubjects: [] });
    setStep("template-builder");
  }

  async function createExam() {
    if (!examName.trim()) return showError("Deneme adı zorunludur.");
    if (!selectedFormat) return showError("Önce bir şablon seç.");
    setCreatingExam(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: examName.trim(), examDate, opticalFormatId: selectedFormat.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sınav oluşturulamadı.");
      setCreatedExamId(data.exam.id);
      showSuccess("Deneme oluşturuldu — şimdi cevap anahtarlarını girebilirsin.");
      setStep("answer-keys");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sınav oluşturulamadı.");
    } finally {
      setCreatingExam(false);
    }
  }

  async function saveAnswerKey(subject: string) {
    const text = (answerTexts[subject] ?? "").trim();
    if (!text || !createdExamId) return showError("Önce cevap anahtarı metnini yapıştır.");
    setSavingSubject(subject);
    try {
      const res = await fetch(`/api/exams/${createdExamId}/answer-key/from-text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      setSavedSubjects((prev) => ({ ...prev, [subject]: data.preview }));
      showSuccess(`${subject}: ${data.questionCount} soru kaydedildi.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSavingSubject(null);
    }
  }

  const orderedSubjects = useMemo(() => selectedFormat?.subjectBlocks.map((b) => ({ subject: b.subject, length: b.length })) ?? [], [selectedFormat]);

  function finish() {
    setStep("done");
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Deneme Oluştur" widthClassName="max-w-3xl">
      {/* Adım göstergesi */}
      <div className="mb-4 flex items-center gap-1.5 text-[10.5px] font-semibold text-espresso-muted dark:text-cream/40">
        {(["template", "exam-info", "answer-keys"] as Step[]).map((s, i) => {
          const active = step === s || (step === "template-builder" && s === "template") || (step === "done" && s === "answer-keys");
          const done =
            (s === "template" && step !== "template" && step !== "template-builder") ||
            (s === "exam-info" && (step === "answer-keys" || step === "done")) ||
            (s === "answer-keys" && step === "done");
          return (
            <div key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-30" />}
              <span
                className={cn(
                  "rounded-full px-2.5 py-1",
                  active ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : done ? "text-emerald-600 dark:text-emerald-400" : ""
                )}
              >
                {done && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
                {s === "template" ? "1. Şablon" : s === "exam-info" ? "2. Deneme Bilgisi" : "3. Cevap Anahtarı"}
              </span>
            </div>
          );
        })}
      </div>

      {step === "template" && (
        <div className="space-y-3">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Bu denemenin türünü seç. Hazır bir tür ilk kez seçiliyorsa, bir kereliğine dersleri ve optik sütun düzenini tanımlarsın — sonraki tüm
            aynı türden denemelerde tekrar sorulmaz.
          </p>
          {formats === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMPLATE_PRESETS.map((preset) => {
                const existing = formatFor(preset.label);
                return (
                  <button
                    key={preset.label}
                    onClick={() => pickPreset(preset)}
                    className="flex flex-col items-start gap-1 rounded-xl border border-hairline bg-white/60 p-3 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-espresso dark:text-cream">
                      {preset.label}
                      {existing ? (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Hazır
                        </span>
                      ) : (
                        <span className="rounded-full bg-cream-card px-2 py-0.5 text-[9.5px] font-medium text-espresso-muted dark:bg-white/10 dark:text-cream/40">İlk kez</span>
                      )}
                    </span>
                    <span className="text-[10.5px] text-espresso-muted dark:text-cream/40">{(existing?.subjectBlocks.map((b) => b.subject) ?? preset.suggestedSubjects).join(", ")}</span>
                  </button>
                );
              })}
              <button
                onClick={pickCustom}
                className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-hairline bg-white/40 p-3 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/15 dark:bg-white/5 sm:col-span-2"
              >
                <span className="text-xs font-semibold text-espresso dark:text-cream">+ Farklı / Özel Şablon</span>
                <span className="text-[10.5px] text-espresso-muted dark:text-cream/40">Yukarıdakilere uymayan bir sınav türü için sıfırdan tanımla.</span>
              </button>
            </div>
          )}
        </div>
      )}

      {step === "template-builder" && builderPreset && (
        <div>
          <button onClick={() => setStep("template")} className="mb-3 flex items-center gap-1 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream">
            <ChevronLeft className="h-3.5 w-3.5" /> Şablon seçimine dön
          </button>
          <p className="mb-3 flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5 shrink-0" /> Bu, &quot;{builderPreset.label || "yeni şablon"}&quot; türü için İLK KEZ yapılan bir kurulum — bir daha sorulmayacak.
          </p>
          <OpticalFormatForm
            initialName={builderPreset.label}
            lockName={!!builderPreset.label}
            initialSubjectNames={builderPreset.suggestedSubjects}
            onCancel={() => setStep("template")}
            onSaved={(format) => {
              setSelectedFormat(format);
              setExamName(`${format.name} — ${new Date().toLocaleDateString("tr-TR")}`);
              setStep("exam-info");
            }}
          />
        </div>
      )}

      {step === "exam-info" && selectedFormat && (
        <div className="space-y-4">
          <p className="flex items-center gap-1.5 rounded-lg border border-hairline bg-cream-card px-3 py-2 text-[11px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
            <ScanLine className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" /> Şablon: <b className="text-espresso dark:text-cream">{selectedFormat.name}</b> ·{" "}
            {selectedFormat.subjectBlocks.map((b) => b.subject).join(", ")}
          </p>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Deneme Adı</label>
            <input
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Tarih</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStep("template")}
              className="flex-1 rounded-xl border border-hairline py-2.5 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              Geri
            </button>
            <button
              onClick={createExam}
              disabled={creatingExam}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {creatingExam ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              Denemeyi Oluştur
            </button>
          </div>
        </div>
      )}

      {step === "answer-keys" && createdExamId && (
        <div className="space-y-4">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Her ders için doğru cevap harflerini SIRAYLA yapıştır (örn. &quot;ABCDEABCDE…&quot;) — soru sayısı metnin uzunluğundan otomatik anlaşılır.
            İstersen bazılarını şimdi atlayıp panelden sonra da girebilirsin.
          </p>
          <div className="space-y-3">
            {orderedSubjects.map(({ subject, length }) => {
              const savedPreview = savedSubjects[subject];
              const currentText = answerTexts[subject] ?? "";
              const cleanLen = currentText.replace(/\s+/g, "").length;
              return (
                <div key={subject} className="rounded-xl border border-hairline bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-espresso dark:text-cream">{subject}</span>
                    <span className="text-[10px] text-espresso-muted dark:text-cream/40">
                      Beklenen: {length} soru · Girilen: <span className={cleanLen === length ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold text-amber-600 dark:text-amber-400"}>{cleanLen}</span>
                    </span>
                  </div>
                  {savedPreview ? (
                    <div className="flex flex-wrap gap-1 rounded-lg bg-emerald-500/5 p-2">
                      {savedPreview.split("").map((ch, i) => (
                        <span key={i} className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          {ch}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={currentText}
                        onChange={(e) => setAnswerTexts((prev) => ({ ...prev, [subject]: e.target.value }))}
                        placeholder="ör. ABCDEABCDEABCD..."
                        className="flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 font-mono text-[11px] uppercase text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                      />
                      <button
                        onClick={() => saveAnswerKey(subject)}
                        disabled={savingSubject === subject || !currentText.trim()}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {savingSubject === subject ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Kaydet
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={finish}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            Tamamla
          </button>
        </div>
      )}

      {step === "done" && createdExamId && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <PartyPopper className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Deneme oluşturuldu!</p>
          <p className="max-w-sm text-[11px] text-espresso-muted dark:text-cream/40">
            &quot;{examName}&quot; artık listende. Kalan cevap anahtarlarını, kazanım atamalarını ve optik dosya yüklemeyi panelden devam ettirebilirsin.
          </p>
          <button
            onClick={() => onFinished(createdExamId)}
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
          >
            Panele Git
          </button>
        </div>
      )}
    </Modal>
  );
}
