"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronRight, ChevronLeft, Database, Save, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Variant = "genel" | "alt_konu" | "yeterlilik";
const VARIANT_LABEL: Record<Variant, string> = { genel: "Genel Konu (30 soru)", alt_konu: "Alt Konu (10 soru)", yeterlilik: "Yeterlilik (20 soru)" };

type RoundRow = { roundNumber: number; testId: string; questionCount: number };
type UnitRow = { unitId: string; label: string; rounds: RoundRow[] };
type QuestionRow = { id: string; order: number; kazanimId: string; prompt: string; correctAnswer: string; solution: string; checks: string };

type View = { level: "units" } | { level: "rounds"; unit: UnitRow } | { level: "questions"; unit: UnitRow; round: RoundRow; questions: QuestionRow[] } | { level: "edit"; unit: UnitRow; round: RoundRow; questions: QuestionRow[]; question: QuestionRow };

// Faz Z15 — kullanıcı talebi: "hazırladığı soruları görmek istiyorum,
// tıklayıp bütün sorulara ulaşabileceğim bir yer, aynı zamanda editleme
// özelliğim de olsun". Havuzdaki soruları birim → tur → soru şeklinde
// katman katman gezip tek bir soruyu (metin/cevap/çözüm/tanı yorumu) elle
// düzenlemeye izin veren SALT bu amaca özel panel. kazanımId/soruNo burada
// KASITLI OLARAK düzenlenemez (bkz. API route yorumu — blueprint kilidi).
export function XrayPoolQuestionsBrowser({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError, showSuccess } = useToast();
  const [variant, setVariant] = useState<Variant>("genel");
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [view, setView] = useState<View>({ level: "units" });
  const [isLoadingRound, setIsLoadingRound] = useState(false);
  const [editDraft, setEditDraft] = useState<{ prompt: string; correctAnswer: string; solution: string; checks: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadUnits = useCallback(async () => {
    setUnits(null);
    try {
      const res = await fetch(`/api/platform/xray-pool-questions?variant=${variant}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setUnits(json.units ?? []);
    } catch {
      showError("Birim listesi yüklenemedi.");
    }
  }, [variant, showError]);

  useEffect(() => {
    if (!isOpen) return;
    setView({ level: "units" });
    loadUnits();
  }, [isOpen, loadUnits]);

  async function openRound(unit: UnitRow, round: RoundRow) {
    setIsLoadingRound(true);
    try {
      const res = await fetch(`/api/platform/xray-pool-questions?testId=${encodeURIComponent(round.testId)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      setView({ level: "questions", unit, round, questions: json.questions });
    } catch {
      showError("Tur yüklenemedi.");
    } finally {
      setIsLoadingRound(false);
    }
  }

  function openEdit(unit: UnitRow, round: RoundRow, questions: QuestionRow[], question: QuestionRow) {
    setEditDraft({ prompt: question.prompt, correctAnswer: question.correctAnswer, solution: question.solution, checks: question.checks });
    setView({ level: "edit", unit, round, questions, question });
  }

  async function saveEdit() {
    if (view.level !== "edit" || !editDraft) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/platform/xray-pool-questions/${view.question.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error);
      showSuccess("Soru güncellendi.");
      const updatedQuestions = view.questions.map((q) => (q.id === view.question.id ? { ...q, ...editDraft } : q));
      setView({ level: "questions", unit: view.unit, round: view.round, questions: updatedQuestions });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border border-hairline bg-white px-3 py-2 text-xs leading-relaxed text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Soru Havuzunu Görüntüle / Düzenle" variant="center" widthClassName="max-w-3xl">
      <div className="space-y-3">
        {view.level === "units" && (
          <div className="flex gap-1 rounded-xl bg-cream-card p-1 dark:bg-white/5">
            {(Object.keys(VARIANT_LABEL) as Variant[]).map((v) => (
              <button
                key={v}
                onClick={() => setVariant(v)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  variant === v ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream" : "text-espresso-muted hover:text-espresso dark:text-cream/40 dark:hover:text-cream",
                )}
              >
                {VARIANT_LABEL[v]}
              </button>
            ))}
          </div>
        )}

        {view.level !== "units" && (
          <button
            onClick={() => {
              if (view.level === "rounds") setView({ level: "units" });
              else if (view.level === "questions") setView({ level: "rounds", unit: view.unit });
              else if (view.level === "edit") setView({ level: "questions", unit: view.unit, round: view.round, questions: view.questions });
            }}
            className="flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Geri
          </button>
        )}

        {view.level === "units" &&
          (units === null ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : units.length === 0 ? (
            <p className="rounded-2xl bg-cream-card px-4 py-10 text-center text-sm text-espresso-muted dark:bg-white/5 dark:text-cream/40">Bu türde henüz üretilmiş soru yok.</p>
          ) : (
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
              {units.map((u) => {
                const totalQuestions = u.rounds.reduce((s, r) => s + r.questionCount, 0);
                return (
                  <button
                    key={u.unitId}
                    onClick={() => setView({ level: "rounds", unit: u })}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-hairline bg-white/50 px-3 py-2.5 text-left transition hover:border-brand-500/40 dark:border-white/10 dark:bg-midnight-card/40"
                  >
                    <span className="truncate text-xs text-espresso dark:text-cream">{u.label}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[11px] text-espresso-muted dark:text-cream/40">
                      <span>{u.rounds.length} tur</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Database className="h-3 w-3" /> {totalQuestions}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

        {view.level === "rounds" && (
          <div>
            <p className="mb-2 text-xs font-semibold text-espresso dark:text-cream">{view.unit.label}</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {view.unit.rounds.map((r) => (
                <button
                  key={r.roundNumber}
                  onClick={() => openRound(view.unit, r)}
                  disabled={isLoadingRound}
                  className="flex items-center justify-between rounded-lg border border-hairline bg-white/50 px-3 py-2 text-left text-xs transition hover:border-brand-500/40 disabled:opacity-50 dark:border-white/10 dark:bg-midnight-card/40"
                >
                  <span className="text-espresso dark:text-cream">Tur {r.roundNumber}</span>
                  <span className="font-mono text-[10px] text-espresso-muted dark:text-cream/40">{r.questionCount}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view.level === "questions" && (
          <div>
            <p className="mb-2 text-xs font-semibold text-espresso dark:text-cream">
              {view.unit.label} — Tur {view.round.roundNumber}
            </p>
            <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
              {view.questions.map((q) => (
                <button
                  key={q.id}
                  onClick={() => openEdit(view.unit, view.round, view.questions, q)}
                  className="flex w-full items-start gap-2 rounded-lg border border-hairline bg-white/50 px-3 py-2 text-left transition hover:border-brand-500/40 dark:border-white/10 dark:bg-midnight-card/40"
                >
                  <span className="mt-0.5 shrink-0 rounded-full bg-cream-card px-1.5 py-0.5 font-mono text-[10px] text-espresso-muted dark:bg-white/10 dark:text-cream/40">{q.order}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-espresso dark:text-cream">{q.prompt}</span>
                  <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-espresso-muted dark:text-cream/40" />
                </button>
              ))}
            </div>
          </div>
        )}

        {view.level === "edit" && editDraft && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-espresso dark:text-cream">
                soruNo {view.question.order} · <span className="font-mono text-[10px] text-espresso-muted dark:text-cream/40">{view.question.kazanimId}</span>
              </p>
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Soru Metni</label>
              <textarea
                value={editDraft.prompt}
                onChange={(e) => setEditDraft({ ...editDraft, prompt: e.target.value })}
                rows={3}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Cevap</label>
              <textarea
                value={editDraft.correctAnswer}
                onChange={(e) => setEditDraft({ ...editDraft, correctAnswer: e.target.value })}
                rows={2}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Detaylı Çözüm</label>
              <textarea
                value={editDraft.solution}
                onChange={(e) => setEditDraft({ ...editDraft, solution: e.target.value })}
                rows={5}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Tanı Yorumu (öğrenci yanlış yaparsa)</label>
              <textarea
                value={editDraft.checks}
                onChange={(e) => setEditDraft({ ...editDraft, checks: e.target.value })}
                rows={2}
                className={fieldClass}
              />
            </div>

            <button
              onClick={saveEdit}
              disabled={isSaving}
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
