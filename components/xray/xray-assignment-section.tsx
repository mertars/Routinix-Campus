"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, ListFilter, Loader2, Lock, Check, Flag, Clock, ChevronDown, X } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { type RosterForTargeting } from "@/components/xray/xray-assignment-target-picker";
import { XrayComprehensionPickerModal } from "@/components/xray/xray-comprehension-picker-modal";
import { XrayInfoButton } from "@/components/xray/xray-info-button";
import { MathText } from "@/components/ui/math-text";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const PREVIEW_COUNT = 3;

const COMPREHENSION_INFO_TEXT =
  "Seçilen konudaki kilitli/çok seçenekli sorulardan oluşur (soru sayısı konuya göre değişir). Kurumumuzun özel soru bankasından gelir, öğrenci teste başladıktan sonra sekme değiştirme/pencere kaybı gibi hareketler tespit edilip işaretlenir — bu yüzden \"kilitli\" test olarak adlandırılır. Her yanlış şık, o kavramda neyin karıştırıldığını gösteren ayrı bir açıklamayla değerlendirilir.";

type Assignment = {
  id: string;
  subtopicId: string;
  subtopicName: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";
  assignedAt: string;
  completedAt: string | null;
  flagReason: string | null;
};
type ResultItem = {
  questionId: string;
  prompt: string;
  solution: string;
  answered: boolean;
  isCorrect: boolean | null;
  selectedLabel: string | null;
  selectedText: string | null;
  diagnosis: string | null;
};

const STATUS_META: Record<Assignment["status"], { label: string; icon: typeof Clock; className: string }> = {
  ASSIGNED: { label: "Bekliyor", icon: Clock, className: "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/40" },
  IN_PROGRESS: { label: "Sınavda", icon: Lock, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  COMPLETED: { label: "Tamamlandı", icon: Check, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  FLAGGED: { label: "İhlal", icon: Flag, className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

// Akademik Röntgen — yöneticinin Test 2 ("Ne Kadar Anlamış") atama ekranı.
// SADECE /xray/principal'da gösterilir (bkz. XrayResultsPanel > canAssign) —
// öğretmen atayamaz, kullanıcının açık isteği bu.
export function XrayAssignmentSection({
  studentId,
  studentName,
  branchId,
  branchName,
  grade,
  subject,
  roster,
}: {
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  subject: string;
  roster: RosterForTargeting[];
}) {
  const { showError } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<"pending" | "done">("pending");

  function loadAssignments() {
    return fetch(`/api/xray/comprehension-assignments?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => showError("Atama geçmişi yüklenemedi."));
  }

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Kullanıcı geri bildirimi — bu öğrenciye daha önce atanmış konular
  // picker'da işaretli görünsün (bkz. XrayPracticeAssignmentSection'daki
  // AYNI desen).
  const assignedSubtopicIds = useMemo(() => new Set(assignments.map((a) => a.subtopicId)), [assignments]);
  const pendingAssignments = useMemo(() => assignments.filter((a) => a.status === "ASSIGNED" || a.status === "IN_PROGRESS"), [assignments]);
  const doneAssignments = useMemo(() => assignments.filter((a) => a.status === "COMPLETED" || a.status === "FLAGGED"), [assignments]);
  const previewList = previewFilter === "pending" ? pendingAssignments : doneAssignments;

  async function toggleExpand(assignment: Assignment) {
    if (assignment.status === "ASSIGNED" || assignment.status === "IN_PROGRESS") return;
    if (expandedId === assignment.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assignment.id);
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/xray/comprehension-assignment/${assignment.id}/results`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sonuç yüklenemedi.");
      setResults(data.questions ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sonuç yüklenemedi.");
    } finally {
      setLoadingResults(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-sky-500/20 bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-sky-400/15 dark:bg-midnight-card/50"
    >
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <ClipboardList className="h-4 w-4 text-sky-600 dark:text-sky-400" /> Ne Kadar Anlamış — Kilitli Test Ata
        <XrayInfoButton text={COMPREHENSION_INFO_TEXT} />
      </h3>

      <button
        onClick={() => setIsPickerOpen(true)}
        className="mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500"
      >
        <ListFilter className="h-4 w-4" /> Test Seç ve Ata
      </button>

      <XrayComprehensionPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        studentId={studentId}
        studentName={studentName}
        branchId={branchId}
        branchName={branchName}
        grade={grade}
        subject={subject}
        roster={roster}
        assignedSubtopicIds={assignedSubtopicIds}
        onAssigned={loadAssignments}
      />

      {assignments.length > 0 && (
        <div className="space-y-2">
          {/* Kullanıcı geri bildirimi — "son 3" yerine "Bekleyen"/"Yapılan"
              diye AYRIŞTIRILMIŞ, doğrudan tıklanabilir 2 tuş — hangi bucket
              seçiliyse önizlemede SADECE o gösterilir. */}
          <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
            <button
              onClick={() => setPreviewFilter("pending")}
              className={cn(
                "rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                previewFilter === "pending" ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream" : "text-espresso-muted hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
              )}
            >
              Bekleyen ({pendingAssignments.length})
            </button>
            <button
              onClick={() => setPreviewFilter("done")}
              className={cn(
                "rounded-lg px-2 py-1.5 text-[11px] font-medium transition",
                previewFilter === "done" ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream" : "text-espresso-muted hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
              )}
            >
              Yapılan ({doneAssignments.length})
            </button>
          </div>
          {previewList.length === 0 ? (
            <p className="px-1 py-2 text-[11px] text-espresso-muted dark:text-cream/40">
              {previewFilter === "pending" ? "Bekleyen test yok." : "Henüz tamamlanan test yok."}
            </p>
          ) : (
            previewList.slice(0, PREVIEW_COUNT).map((a) => renderAssignmentRow(a))
          )}
          {assignments.length > Math.min(previewList.length, PREVIEW_COUNT) && (
            <button
              onClick={() => setHistoryOpen(true)}
              className="w-full rounded-xl border border-dashed border-hairline py-2 text-[11px] font-medium text-espresso-muted transition hover:border-sky-400/40 hover:text-sky-600 dark:border-white/10 dark:text-cream/40 dark:hover:text-sky-400"
            >
              Tümünü Gör ({assignments.length})
            </button>
          )}
        </div>
      )}

      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="Ne Kadar Anlamış — Tüm Atamalar" variant="center" widthClassName="max-w-lg">
        <div className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">{assignments.map((a) => renderAssignmentRow(a))}</div>
      </Modal>
    </motion.div>
  );

  function renderAssignmentRow(a: Assignment) {
    const meta = STATUS_META[a.status];
    const Icon = meta.icon;
    const canExpand = a.status === "COMPLETED" || a.status === "FLAGGED";
    const isExpanded = expandedId === a.id;
    return (
      <div key={a.id} className="overflow-hidden rounded-xl bg-cream-card dark:bg-white/5">
        <button
          onClick={() => toggleExpand(a)}
          disabled={!canExpand}
          className={cn("flex w-full items-center justify-between gap-2 px-3 py-2 text-left", canExpand && "cursor-pointer")}
        >
          <span className="min-w-0 truncate text-xs font-medium text-espresso dark:text-cream">{a.subtopicName}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.className)}>
              <Icon className="h-3 w-3" /> {meta.label}
            </span>
            {canExpand && (
              <ChevronDown className={cn("h-3.5 w-3.5 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
            )}
          </span>
        </button>
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="space-y-2 px-3 pb-3">
                {a.status === "FLAGGED" && a.flagReason && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                    <X className="h-3 w-3 shrink-0" /> {a.flagReason}
                  </div>
                )}
                {loadingResults ? (
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">Yükleniyor...</p>
                ) : (
                  results.map((r, index) => (
                    <div key={r.questionId} className="rounded-lg bg-white p-2.5 dark:bg-midnight-card">
                      <p className="mb-1 text-[10px] font-semibold text-espresso-muted dark:text-cream/40">Soru {index + 1}</p>
                      <MathText text={r.prompt} className="mb-1.5 text-xs font-medium text-espresso dark:text-cream" />
                      {r.answered ? (
                        <>
                          <p className={cn("mb-1 text-[11px] font-semibold", r.isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                            Seçilen: {r.selectedLabel}) <MathText text={r.selectedText ?? ""} />
                          </p>
                          {r.diagnosis && <MathText text={r.diagnosis} className="text-[11px] text-espresso-muted dark:text-cream/50" />}
                        </>
                      ) : (
                        <p className="text-[11px] italic text-espresso-muted dark:text-cream/40">Bu soru cevaplanmadı.</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
}
