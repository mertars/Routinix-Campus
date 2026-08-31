"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, ListFilter, Loader2, Clock, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { type RosterForTargeting } from "@/components/xray/xray-assignment-target-picker";
import { XrayTestPickerModal } from "@/components/xray/xray-test-picker-modal";
import { XrayInfoButton } from "@/components/xray/xray-info-button";
import { cn } from "@/lib/utils";

type Assignment = {
  id: string;
  subtopicId: string;
  subtopicName: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";
  assignedAt: string;
  completedAt: string | null;
};
type ResultItem = {
  questionId: string;
  order: number;
  prompt: string;
  correctAnswer: string;
  solution: string;
  checks: string;
  wasCorrect: boolean | null;
};

const STATUS_META: Record<Assignment["status"], { label: string; icon: typeof Clock; className: string }> = {
  ASSIGNED: { label: "Bekliyor", icon: Clock, className: "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/40" },
  IN_PROGRESS: { label: "Çözüyor", icon: Loader2, className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  COMPLETED: { label: "Tamamlandı", icon: Check, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  FLAGGED: { label: "İhlal", icon: Clock, className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

const VARIANT_META: Record<string, { title: string; infoText: string }> = {
  genel: {
    title: "Genel Konu Testi — Açık Uçlu",
    infoText:
      "30 sorudan oluşur ve seçilen konuyu üç aşamada ölçer: ilk 10 soru temel kavrama, sonraki 10 soru kuralların uygulanması, son 10 soru ise birden fazla kuralı birleştiren kapsamlı problemler. Kurumumuzun özel soru bankasından her denemede farklı bir soru kümesiyle gelir, her yanlış cevap hangi kuralın eksik olduğunu gösteren ayrı bir tanı notuyla işaretlenir.",
  },
  alt_konu: {
    title: "Alt Konu Testi — Açık Uçlu",
    infoText:
      "10 sorudan oluşur ve TEK bir alt konuyu derinlemesine ölçer. Tüm sorular orta-üst seviyededir — kuralın gerçek bir işlemle uygulanmasını gerektirir, basit tanım/ezber sorusu yoktur. Kurumumuzun özel soru bankasından her seferinde farklı bir örnek kümesiyle gelir, öğrencinin o alt konudaki gerçek işlem becerisini test eder.",
  },
};

// Akademik Röntgen — Faz H: yöneticinin Test 1 ("Konu Bilgisi", açık uçlu,
// kilitsiz) atama ekranı. xray-assignment-section.tsx'teki (Test 2) BİREBİR
// AYNI desen — SADECE /xray/principal'da gösterilir (bkz. XrayResultsPanel >
// canAssign), öğretmen atayamaz. Faz Z6: variant prop'u ile hem "genel"
// (tema geneli, 30 soru) hem "alt_konu" (tek alt konu, 10 soru) için AYNI
// bileşen render edilir — havuzlar birbirine karışmasın diye TÜM istekler
// (liste + atama) variant'ı taşır (bkz. ilgili route.ts'lerin yorumu).
export function XrayPracticeAssignmentSection({
  studentId,
  studentName,
  branchId,
  branchName,
  grade,
  subject,
  variant = "genel",
  roster,
}: {
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  subject: string;
  variant?: "genel" | "alt_konu";
  roster: RosterForTargeting[];
}) {
  const { showError } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const meta = VARIANT_META[variant];

  function loadAssignments() {
    return fetch(`/api/xray/practice-assignments?studentId=${encodeURIComponent(studentId)}&variant=${encodeURIComponent(variant)}`)
      .then((res) => res.json())
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => showError("Atama geçmişi yüklenemedi."));
  }

  useEffect(() => {
    loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, variant]);

  // Faz Z15 — kullanıcı talebi: test seçme ekranında bu öğrenciye DAHA ÖNCE
  // atanmış konular işaretli görünsün (yine de tekrar atılabilsin) — zaten
  // burada elimizde olan assignments listesinden hesaplanıyor, ayrı bir API
  // gerekmiyor.
  const assignedSubtopicIds = useMemo(() => new Set(assignments.map((a) => a.subtopicId)), [assignments]);

  async function toggleExpand(assignment: Assignment) {
    if (assignment.status === "ASSIGNED" || assignment.status === "IN_PROGRESS") return;
    if (expandedId === assignment.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(assignment.id);
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/xray/practice-attempt/${assignment.id}/results`);
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
        <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" /> {meta.title}
        <XrayInfoButton text={meta.infoText} />
      </h3>

      <button
        onClick={() => setIsPickerOpen(true)}
        className="mb-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500"
      >
        <ListFilter className="h-4 w-4" /> Test Seç ve Ata
      </button>

      <XrayTestPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        studentId={studentId}
        studentName={studentName}
        branchId={branchId}
        branchName={branchName}
        grade={grade}
        subject={subject}
        variant={variant}
        roster={roster}
        assignedSubtopicIds={assignedSubtopicIds}
        onAssigned={loadAssignments}
      />

      {assignments.length > 0 && (
        <div className="space-y-1.5">
          {assignments.map((a) => {
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
                        {loadingResults ? (
                          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Yükleniyor...</p>
                        ) : (
                          results.map((r) => (
                            <div key={r.questionId} className="rounded-lg bg-white p-2.5 dark:bg-midnight-card">
                              <div className="mb-1 flex items-center justify-between">
                                <p className="text-[10px] font-semibold text-espresso-muted dark:text-cream/40">Soru {r.order}</p>
                                {r.wasCorrect !== null && (
                                  <span className={cn("text-[10px] font-semibold", r.wasCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                                    {r.wasCorrect ? "Yaptı" : "Yapamadı"}
                                  </span>
                                )}
                              </div>
                              <p className="mb-1.5 text-xs font-medium text-espresso dark:text-cream">{r.prompt}</p>
                              <p className="mb-1 text-[11px] font-semibold text-sky-600 dark:text-sky-300">Cevap: {r.correctAnswer}</p>
                              {r.wasCorrect === false && <p className="text-[11px] text-espresso-muted dark:text-cream/50">{r.checks}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
