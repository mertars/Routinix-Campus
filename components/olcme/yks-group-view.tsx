"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Layers, CalendarDays, Users, X, Check, ChevronRight, Link2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import { type ExamGroupItem, formatExamDate } from "./types";

type AvailableExam = { id: string; name: string; examDate: string; categoryName: string | null };

// YKS klasörü — tekil deneme değil, TYT + AYT oturumlarının EŞLEŞMESİ
// listelenir (kullanıcı kararı: "YKS sekmesinde denemeler ikili ele
// alınacak"). Her eşleşme bir ExamGroup; analiz tarafında tek bir deneme
// gibi davranır, toplam net iki oturumun toplamıdır.
//
// Oturumların kendisi yine kendi klasörlerinde (TYT / AYT) tekil deneme
// olarak durur — eşleştirme onları KOPYALAMAZ, sadece ilişkilendirir.
export function YksGroupView({
  categoryName,
  onSelectExam,
  onChanged,
}: {
  categoryName: string;
  onSelectExam: (examId: string) => void;
  onChanged: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [groups, setGroups] = useState<ExamGroupItem[] | null>(null);
  const [available, setAvailable] = useState<AvailableExam[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const data = await fetch("/api/exam-groups").then((r) => r.json()).catch(() => null);
    if (!data) return showError("Eşleşmeler yüklenemedi.");
    setGroups(data.groups ?? []);
    setAvailable(data.availableExams ?? []);
  }, [showError]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!name.trim()) return showError("Deneme adı zorunludur.");
    if (selected.length < 2) return showError("En az iki oturum seç (TYT ve AYT).");
    setSaving(true);
    try {
      const res = await fetch("/api/exam-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), examIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Oluşturulamadı.");
      showSuccess("YKS denemesi eşleştirildi.");
      setCreating(false);
      setName("");
      setSelected([]);
      await load();
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(group: ExamGroupItem) {
    if (!window.confirm(`"${group.name}" eşleştirmesi kaldırılsın mı? Oturumlar SİLİNMEZ, kendi klasörlerinde kalır.`)) return;
    const res = await fetch(`/api/exam-groups/${group.id}`, { method: "DELETE" });
    if (!res.ok) return showError("Kaldırılamadı.");
    await load();
    onChanged();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-espresso dark:text-cream">
            <Layers className="h-5 w-5 text-sky-600 dark:text-sky-400" /> {categoryName}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-espresso-muted dark:text-cream/40">
            Bir YKS denemesi iki oturumdur: TYT ve AYT. İkisini eşleştirdiğinde toplam net ikisinin toplamı olarak hesaplanır ve analizde tek bir
            deneme gibi görünür.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500"
        >
          <Plus className="h-4 w-4" /> YKS Denemesi Eşleştir
        </button>
      </div>

      {groups === null ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-hairline bg-white/40 py-20 text-center dark:border-white/10 dark:bg-white/5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
            <Link2 className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-sm font-semibold text-espresso dark:text-cream">Henüz eşleştirme yok</p>
          <p className="max-w-sm text-xs leading-relaxed text-espresso-muted dark:text-cream/40">
            Önce TYT ve AYT denemelerini kendi klasörlerinde oluştur, sonra burada ikisini tek bir YKS denemesi olarak eşleştir.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group, i) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
              className="group rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-espresso dark:text-cream">{group.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-espresso-muted dark:text-cream/40">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3 w-3" /> {formatExamDate(group.examDate)}
                    </span>
                    <span className={cn("flex items-center gap-1.5", group.studentCount > 0 && "text-emerald-700 dark:text-emerald-400")}>
                      <Users className="h-3 w-3" /> {group.studentCount} öğrenci
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => remove(group)}
                  title="Eşleştirmeyi kaldır"
                  className="rounded-lg p-1.5 text-espresso-muted/40 opacity-0 transition hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100 dark:text-cream/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {group.exams.map((exam) => (
                  <button
                    key={exam.id}
                    onClick={() => onSelectExam(exam.id)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-cream-card/50 px-3 py-2.5 text-left transition hover:border-sky-400/40 hover:bg-sky-500/5 dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        {exam.categoryName && (
                          <span className="shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold text-sky-700 dark:text-sky-300">
                            {exam.categoryName}
                          </span>
                        )}
                        <span className="truncate text-[11.5px] font-medium text-espresso dark:text-cream">{exam.name}</span>
                      </span>
                      <span className="mt-0.5 block text-[10px] text-espresso-muted dark:text-cream/40">{formatExamDate(exam.examDate)}</span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal isOpen={creating} onClose={() => setCreating(false)} title="YKS Denemesi Eşleştir" widthClassName="max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Deneme Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. 3. YKS Denemesi"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none transition focus:border-sky-500 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium text-espresso-muted dark:text-cream/40">
              Oturumları seç <span className="font-normal opacity-70">— TYT ve AYT denemelerini işaretle</span>
            </p>
            {available.length === 0 ? (
              <p className="rounded-xl border border-dashed border-hairline py-6 text-center text-[11px] leading-relaxed text-espresso-muted dark:border-white/10 dark:text-cream/40">
                Eşleştirilebilecek deneme yok — önce TYT ve AYT klasörlerinde deneme oluştur.
              </p>
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
                {available.map((exam) => {
                  const checked = selected.includes(exam.id);
                  return (
                    <button
                      key={exam.id}
                      onClick={() => setSelected((prev) => (checked ? prev.filter((id) => id !== exam.id) : [...prev, exam.id]))}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition",
                        checked ? "border-sky-500/40 bg-sky-500/5" : "border-hairline hover:bg-cream-card dark:border-white/10 dark:hover:bg-white/5"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                          checked ? "border-sky-500 bg-sky-600 text-white" : "border-hairline dark:border-white/20"
                        )}
                      >
                        {checked && <Check className="h-2.5 w-2.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {exam.categoryName && (
                            <span className="shrink-0 rounded-full bg-cream-muted px-1.5 py-0.5 text-[9px] font-bold text-espresso-muted dark:bg-white/10 dark:text-cream/40">
                              {exam.categoryName}
                            </span>
                          )}
                          <span className="truncate text-[11.5px] font-medium text-espresso dark:text-cream">{exam.name}</span>
                        </span>
                        <span className="mt-0.5 block text-[10px] text-espresso-muted dark:text-cream/40">{formatExamDate(exam.examDate)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={create}
            disabled={saving || selected.length < 2}
            className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {selected.length} Oturumu Eşleştir
          </button>
        </div>
      </Modal>
    </div>
  );
}
