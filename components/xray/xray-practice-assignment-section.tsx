"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Send, Loader2, Clock, Check, ChevronDown } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { XrayAssignmentTargetPicker, type AssignmentTarget } from "@/components/xray/xray-assignment-target-picker";
import { XrayInfoButton } from "@/components/xray/xray-info-button";
import { cn } from "@/lib/utils";

type Topic = { subtopicId: string; subtopicName: string; questionCount: number; kazanimCount: number };
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
}: {
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  subject: string;
  variant?: "genel" | "alt_konu";
}) {
  const { showError, showToast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [targetType, setTargetType] = useState<AssignmentTarget["type"]>("student");
  const meta = VARIANT_META[variant];

  useEffect(() => {
    setSelectedTopic("");
    fetch(`/api/xray/practice-tests?subject=${encodeURIComponent(subject)}&variant=${encodeURIComponent(variant)}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.topics ?? []);
        setSelectedTopic((current) => current || data.topics?.[0]?.subtopicId || "");
      })
      .catch(() => showError("Konu listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, variant]);

  useEffect(() => {
    setTargetType("student");
    fetch(`/api/xray/practice-assignments?studentId=${encodeURIComponent(studentId)}&variant=${encodeURIComponent(variant)}`)
      .then((res) => res.json())
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => showError("Atama geçmişi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, variant]);

  async function assign() {
    if (!selectedTopic) return;
    setAssigning(true);
    try {
      const target: AssignmentTarget =
        targetType === "student" ? { type: "student", studentId } : targetType === "branch" ? { type: "branch", branchId } : { type: "grade", grade };
      const res = await fetch("/api/xray/practice-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, subtopicId: selectedTopic, target, variant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atanamadı.");
      showToast("success", data.created > 1 ? `Test ${data.created} öğrenciye atandı.` : "Test atandı — öğrencinin panelinde görünecek.");
      const refreshed = await fetch(`/api/xray/practice-assignments?studentId=${encodeURIComponent(studentId)}&variant=${encodeURIComponent(variant)}`).then((r) => r.json());
      setAssignments(refreshed.assignments ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atanamadı.");
    } finally {
      setAssigning(false);
    }
  }

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

      {topics.length === 0 ? (
        <p className="text-xs text-espresso-muted dark:text-cream/40">Bu ders için soru havuzunda henüz içerik yok.</p>
      ) : (
        <div className="mb-4">
          <XrayAssignmentTargetPicker studentName={studentName} branchName={branchName} grade={grade} value={targetType} onChange={setTargetType} />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedTopic}
              onChange={(event) => setSelectedTopic(event.target.value)}
              className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            >
              {topics.map((t) => (
                <option key={t.subtopicId} value={t.subtopicId}>
                  {t.subtopicName} ({t.questionCount} soru havuzu)
                </option>
              ))}
            </select>
            <button
              onClick={assign}
              disabled={assigning}
              className="flex min-h-[40px] items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ata
            </button>
          </div>
        </div>
      )}

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
