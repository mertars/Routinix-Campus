"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Send, Loader2, Lock, Check, Flag, Clock } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Topic = { subtopicId: string; name: string; questionCount: number };
type Assignment = {
  id: string;
  subtopicId: string;
  subtopicName: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";
  assignedAt: string;
  completedAt: string | null;
  flagReason: string | null;
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
export function XrayAssignmentSection({ studentId, subject }: { studentId: string; subject: string }) {
  const { showError, showToast } = useToast();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetch(`/api/xray/comprehension-topics?subject=${encodeURIComponent(subject)}`)
      .then((res) => res.json())
      .then((data) => {
        setTopics(data.subtopics ?? []);
        setSelectedTopic((current) => current || data.subtopics?.[0]?.subtopicId || "");
      })
      .catch(() => showError("Konu listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  useEffect(() => {
    fetch(`/api/xray/comprehension-assignments?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setAssignments(data.assignments ?? []))
      .catch(() => showError("Atama geçmişi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function assign() {
    if (!selectedTopic) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/xray/comprehension-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, subject, subtopicId: selectedTopic }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atanamadı.");
      showToast("success", "Test atandı — öğrencinin panelinde görünecek.");
      const refreshed = await fetch(`/api/xray/comprehension-assignments?studentId=${encodeURIComponent(studentId)}`).then((r) => r.json());
      setAssignments(refreshed.assignments ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atanamadı.");
    } finally {
      setAssigning(false);
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
      </h3>

      {topics.length === 0 ? (
        <p className="text-xs text-espresso-muted dark:text-cream/40">Bu ders için soru havuzunda henüz içerik yok.</p>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={selectedTopic}
            onChange={(event) => setSelectedTopic(event.target.value)}
            className="flex-1 rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {topics.map((t) => (
              <option key={t.subtopicId} value={t.subtopicId}>
                {t.name} ({t.questionCount} soru)
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
      )}

      {assignments.length > 0 && (
        <div className="space-y-1.5">
          {assignments.map((a) => {
            const meta = STATUS_META[a.status];
            const Icon = meta.icon;
            return (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2 dark:bg-white/5">
                <span className="min-w-0 truncate text-xs font-medium text-espresso dark:text-cream">{a.subtopicName}</span>
                <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", meta.className)}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
