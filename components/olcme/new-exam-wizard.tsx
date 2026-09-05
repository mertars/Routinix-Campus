"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, CheckCircle2, ChevronLeft, ScanLine, Sparkles, ArrowRight, Plus } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { OpticalFormatForm } from "./optical-format-form";
import type { OpticalFormat } from "./optical-format-manager";
import { CATEGORY_PRESETS } from "./types";

type TemplatePreset = { label: string; suggestedSubjects: string[] };

// Hazır sınav türleri. Bir tür İLK KEZ seçildiğinde optik şablonu (dersler
// + sabit-genişlikli sütun aralıkları) bir kereliğine tanımlanır; sonraki
// tüm aynı türden denemelerde doğrudan kullanılır.
const TEMPLATE_PRESETS: TemplatePreset[] = [
  { label: "TYT", suggestedSubjects: ["Türkçe", "Sosyal Bilimler", "Temel Matematik", "Fen Bilimleri"] },
  { label: "AYT Sayısal", suggestedSubjects: ["Matematik", "Fizik", "Kimya", "Biyoloji"] },
  { label: "AYT Eşit Ağırlık", suggestedSubjects: ["Matematik", "Edebiyat", "Tarih-1", "Coğrafya-1"] },
  { label: "AYT Sözel", suggestedSubjects: ["Edebiyat-Coğrafya", "Tarih-2", "Coğrafya-2", "Felsefe Grubu"] },
  { label: "Sınıf Seviye Değerlendirme (Lise)", suggestedSubjects: ["Türkçe", "Matematik", "Fizik", "Kimya", "Biyoloji", "Tarih", "Coğrafya"] },
  { label: "Sınıf Seviye Değerlendirme (Ortaokul)", suggestedSubjects: ["Türkçe", "Matematik", "Fen Bilimleri", "Sosyal Bilgiler", "İngilizce"] },
];

type Step = "template" | "builder" | "info";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// "Yeni Deneme" — sadece iki karar sorar: hangi şablon, hangi ad/tarih.
// Cevap anahtarı ve sonuç yükleme BİLEREK burada DEĞİL: ikisi de denemeye
// özel, tekrar tekrar dönülen işler; onların yeri detay ekranının adımları
// (bkz. exam-detail-view.tsx). Bu ayrım, önceki sürümde "şablon cevap
// anahtarını da mı saklıyor?" karışıklığına yol açan tasarımın düzeltmesi.
export function NewExamWizard({
  isOpen,
  onClose,
  onCreated,
  defaultCategory,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (examId: string) => void;
  // Bir klasörün içindeyken "Yeni Deneme"ye basılmışsa o klasör önceden
  // seçili gelir — yönetici aynı kararı tekrar vermesin.
  defaultCategory?: string;
}) {
  const { showError, showSuccess } = useToast();
  const [step, setStep] = useState<Step>("template");
  const [formats, setFormats] = useState<OpticalFormat[] | null>(null);
  const [builderPreset, setBuilderPreset] = useState<TemplatePreset | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<OpticalFormat | null>(null);
  const [examName, setExamName] = useState("");
  const [examDate, setExamDate] = useState(todayIso());
  const [category, setCategory] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep("template");
    setBuilderPreset(null);
    setSelectedFormat(null);
    setExamName("");
    setExamDate(todayIso());
    setCategory(defaultCategory ?? "");
    fetch("/api/optical-formats")
      .then((res) => res.json())
      .then((data) => setFormats(data.formats ?? []))
      .catch(() => showError("Şablonlar yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Kurumun kendi oluşturduğu, hazır listede karşılığı olmayan şablonlar
  // da seçilebilmeli (örn. "Farklı"dan tanımlanmış özel bir tür).
  const customFormats = useMemo(() => {
    if (!formats) return [];
    const presetNames = new Set(TEMPLATE_PRESETS.map((p) => p.label));
    return formats.filter((f) => !presetNames.has(f.name));
  }, [formats]);

  function chooseFormat(format: OpticalFormat) {
    setSelectedFormat(format);
    setExamName(`${format.name} — ${new Date().toLocaleDateString("tr-TR")}`);
    // Klasörü şablon adından tahmin et ("AYT Sayısal" → "AYT") — yönetici
    // istemezse değiştirir; çoğu zaman doğru olur ve bir karar eksilir.
    if (!defaultCategory) {
      const guessed = CATEGORY_PRESETS.find((p) => format.name.toLocaleUpperCase("tr").startsWith(p.toLocaleUpperCase("tr")));
      setCategory(guessed ?? "");
    }
    setStep("info");
  }

  function pickPreset(preset: TemplatePreset) {
    const existing = formats?.find((f) => f.name === preset.label);
    if (existing) return chooseFormat(existing);
    setBuilderPreset(preset);
    setStep("builder");
  }

  async function create() {
    if (!examName.trim()) return showError("Deneme adı zorunludur.");
    if (!selectedFormat) return showError("Önce bir şablon seç.");
    setCreating(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: examName.trim(), examDate, opticalFormatId: selectedFormat.id, category: category.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Deneme oluşturulamadı.");
      showSuccess("Deneme oluşturuldu.");
      onCreated(data.exam.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Deneme oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Deneme" widthClassName="max-w-2xl">
      {step === "template" && (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
            Denemenin türünü seç. Bir türü ilk kez seçtiğinde optik dosyanın sütun düzenini bir kereliğine tanımlarsın; sonraki tüm aynı türden
            denemelerde tekrar sorulmaz.
          </p>

          {formats === null ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {TEMPLATE_PRESETS.map((preset) => {
                  const existing = formats.find((f) => f.name === preset.label);
                  return (
                    <button
                      key={preset.label}
                      onClick={() => pickPreset(preset)}
                      className="flex flex-col items-start gap-1.5 rounded-xl border border-hairline bg-white/60 p-3 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/10 dark:bg-white/5"
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-espresso dark:text-cream">{preset.label}</span>
                        {existing ? (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Hazır
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-cream-card px-2 py-0.5 text-[9.5px] font-medium text-espresso-muted dark:bg-white/10 dark:text-cream/40">
                            Kurulum gerekir
                          </span>
                        )}
                      </span>
                      <span className="text-[10.5px] leading-relaxed text-espresso-muted dark:text-cream/40">
                        {(existing?.subjectBlocks.map((b) => b.subject) ?? preset.suggestedSubjects).join(" · ")}
                      </span>
                    </button>
                  );
                })}
              </div>

              {customFormats.length > 0 && (
                <div className="space-y-2 border-t border-hairline pt-3 dark:border-white/10">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Kendi şablonların</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customFormats.map((format) => (
                      <button
                        key={format.id}
                        onClick={() => chooseFormat(format)}
                        className="flex flex-col items-start gap-1 rounded-xl border border-hairline bg-white/60 p-3 text-left transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/10 dark:bg-white/5"
                      >
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                          <ScanLine className="h-3 w-3 opacity-60" /> {format.name}
                        </span>
                        <span className="text-[10.5px] text-espresso-muted dark:text-cream/40">{format.subjectBlocks.map((b) => b.subject).join(" · ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setBuilderPreset({ label: "", suggestedSubjects: [] });
                  setStep("builder");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline bg-white/40 py-2.5 text-[11.5px] font-semibold text-espresso transition hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:border-white/15 dark:bg-white/5 dark:text-cream"
              >
                <Plus className="h-3.5 w-3.5" /> Farklı / Özel Şablon
              </button>
            </>
          )}
        </div>
      )}

      {step === "builder" && builderPreset && (
        <div>
          <button
            onClick={() => setStep("template")}
            className="mb-3 flex items-center gap-1 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Şablon seçimine dön
          </button>
          <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-300">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            &quot;{builderPreset.label || "Özel şablon"}&quot; için tek seferlik kurulum. Optik dosyandan bir satır yapıştırırsan alanların doğru yeri
            kestiğini anında görebilirsin.
          </p>
          <OpticalFormatForm
            initialName={builderPreset.label}
            lockName={!!builderPreset.label}
            initialSubjectNames={builderPreset.suggestedSubjects}
            onCancel={() => setStep("template")}
            onSaved={(format) => chooseFormat(format)}
          />
        </div>
      )}

      {step === "info" && selectedFormat && (
        <div className="space-y-4">
          <button
            onClick={() => setStep("template")}
            className="flex items-center gap-1 text-[11px] font-medium text-espresso-muted transition hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Şablonu değiştir
          </button>

          <div className="rounded-xl border border-hairline bg-cream-card px-3 py-2.5 dark:border-white/10 dark:bg-white/5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-espresso dark:text-cream">
              <ScanLine className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {selectedFormat.name}
            </p>
            <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/40">
              {selectedFormat.subjectBlocks.map((b) => `${b.subject} (${b.length} soru)`).join(" · ")}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Deneme Adı</label>
            <input
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Tarih</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">
              Klasör <span className="font-normal opacity-70">— listede hangi grupta görünsün</span>
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CATEGORY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setCategory(category === preset ? "" : preset)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition",
                    category === preset
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="veya kendi klasör adını yaz (boş bırakılabilir)"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none transition focus:border-emerald-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>

          <button
            onClick={create}
            disabled={creating}
            className={cn(
              "flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-semibold text-white transition hover:bg-emerald-500",
              creating && "opacity-60"
            )}
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Oluştur ve Cevap Anahtarına Geç
          </button>
        </div>
      )}
    </Modal>
  );
}
