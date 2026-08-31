"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Send, Loader2, CheckCircle2, Database, ListTree } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { XrayAssignmentTargetPicker, type AssignmentTarget, type RosterForTargeting } from "@/components/xray/xray-assignment-target-picker";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Topic = { subtopicId: string; subtopicName: string; topicName: string; grade: number; questionCount: number; kazanimCount: number };

// Faz Z15 — kullanıcı talebi: havuz artık (yüzlerce soru/konu) büyüdüğü
// için eski küçük <select> dropdown'ı hem taşıyordu (native select, dar
// panelde uzun liste ile ekran dışına çıkıyordu) hem de arama/filtre imkânı
// yoktu. Bu, aynı akışı (hedef seç → konu seç → ata) AYRI, geniş bir
// ekranda arama + sınıf filtresi + "bu öğrenciye daha önce atandı mı"
// işaretiyle sunan modal — xray-practice-assignment-section.tsx'teki eski
// inline <select>+"Ata" bloğunun yerine geçer.
export function XrayTestPickerModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  branchId,
  branchName,
  grade,
  subject,
  variant,
  roster,
  assignedSubtopicIds,
  onAssigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  subject: string;
  variant: "genel" | "alt_konu";
  roster: RosterForTargeting[];
  assignedSubtopicIds: Set<string>;
  onAssigned: () => void;
}) {
  const { showError, showToast } = useToast();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [target, setTarget] = useState<AssignmentTarget>({ type: "student", studentId });
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setGradeFilter("all");
    setTarget({ type: "student", studentId });
    setTopics(null);
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(subject)}&variant=${encodeURIComponent(variant)}`)
      .then((res) => res.json())
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => showError("Konu listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subject, variant, studentId]);

  const gradeOptions = useMemo(() => (topics ? [...new Set(topics.map((t) => t.grade))].sort((a, b) => a - b) : []), [topics]);

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return topics.filter((t) => {
      if (gradeFilter !== "all" && t.grade !== gradeFilter) return false;
      if (!q) return true;
      return t.subtopicName.toLocaleLowerCase("tr-TR").includes(q) || t.topicName.toLocaleLowerCase("tr-TR").includes(q);
    });
  }, [topics, search, gradeFilter]);

  async function assign(topic: Topic) {
    setAssigningId(topic.subtopicId);
    try {
      const res = await fetch("/api/xray/practice-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subtopicId: topic.subtopicId, target, variant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atanamadı.");
      showToast("success", data.created > 1 ? `Test ${data.created} öğrenciye atandı.` : "Test atandı — öğrencinin panelinde görünecek.");
      onAssigned();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atanamadı.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Test Seç ve Ata" variant="center" widthClassName="max-w-2xl">
      <div className="space-y-3">
        <XrayAssignmentTargetPicker
          studentId={studentId}
          studentName={studentName}
          branchId={branchId}
          branchName={branchName}
          grade={grade}
          roster={roster}
          value={target}
          onChange={setTarget}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Konu ara..."
              className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setGradeFilter("all")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                gradeFilter === "all" ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400/60 dark:text-sky-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5",
              )}
            >
              Tüm Sınıflar
            </button>
            {gradeOptions.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                  gradeFilter === g ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400/60 dark:text-sky-300" : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5",
                )}
              >
                {g}. Sınıf
              </button>
            ))}
          </div>
        </div>

        {topics === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl bg-cream-card px-4 py-10 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">Eşleşen konu bulunamadı.</p>
        ) : (
          <div className="max-h-[50vh] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((t) => {
              const isAssigned = assignedSubtopicIds.has(t.subtopicId);
              const isAssigning = assigningId === t.subtopicId;
              return (
                <button
                  key={t.subtopicId}
                  onClick={() => assign(t)}
                  disabled={assigningId !== null}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-hairline bg-white/60 px-3 py-2.5 text-left transition hover:border-sky-500/40 disabled:opacity-60 dark:border-white/10 dark:bg-midnight-card/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-espresso dark:text-cream">{t.subtopicName}</span>
                      {isAssigned && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Daha önce atandı
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {t.grade}. Sınıf · {t.topicName}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] text-espresso-muted dark:text-cream/40">
                    <span className="flex items-center gap-1 font-mono">
                      <Database className="h-3 w-3" /> {t.questionCount}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <ListTree className="h-3 w-3" /> {t.kazanimCount}
                    </span>
                    {isAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-600" /> : <Send className="h-3.5 w-3.5 text-sky-600" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
