"use client";

import { useEffect, useState } from "react";
import { Loader2, ChevronDown, XCircle, CalendarClock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type WrongQuestion = { questionText: string; correctAnswer: string; solution: string; checks: string; kazanimId: string };
type AttemptDetail = { attemptId: string; assignedAt: string; completedAt: string | null; total: number; correct: number; masteryScore: number | null; wrongQuestions: WrongQuestion[] };

function scoreTextColor(score: number | null): string {
  if (score === null) return "text-espresso-muted dark:text-cream/30";
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function AttemptRow({ attempt }: { attempt: AttemptDetail }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-hairline bg-white/60 dark:border-white/10 dark:bg-white/5">
      <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left" disabled={attempt.wrongQuestions.length === 0}>
        <div className="flex items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/40" />
          <div>
            <p className="text-xs font-medium text-espresso dark:text-cream">{attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString("tr-TR") : "Devam ediyor"}</p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">
              {attempt.correct}/{attempt.total} doğru
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", scoreTextColor(attempt.masteryScore))}>{attempt.masteryScore === null ? "—" : `%${attempt.masteryScore}`}</span>
          {attempt.wrongQuestions.length > 0 && <ChevronDown className={cn("h-3.5 w-3.5 text-espresso-muted transition-transform dark:text-cream/40", expanded && "rotate-180")} />}
        </div>
      </button>
      {expanded && attempt.wrongQuestions.length > 0 && (
        <div className="space-y-2 border-t border-hairline px-3 py-2.5 dark:border-white/10">
          {attempt.wrongQuestions.map((q, i) => (
            <div key={i} className="rounded-lg bg-rose-50 p-2.5 text-xs dark:bg-rose-500/10">
              <div className="mb-1 flex items-start gap-1.5">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                <p className="font-medium text-espresso dark:text-cream">{q.questionText}</p>
              </div>
              <p className="mb-1 text-espresso-muted dark:text-cream/50">
                Doğru cevap: <span className="font-semibold text-emerald-700 dark:text-emerald-400">{q.correctAnswer}</span>
              </p>
              <p className="text-rose-700 dark:text-rose-300">{q.checks}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Faz Z6 — orta sütundaki konu kartlarında bir ALT KONUYA tıklayınca açılır:
// o öğrencinin bu alt konudaki TÜM geçmiş Test 1 denemeleri (ne zaman
// yapıldı, kaç doğru/yanlış) + her denemede HANGİ sorular yanlış yapıldı,
// doğru cevabı ve tanı yorumu (checks — "konu eksiği" burada) ile birlikte.
export function XraySubtopicDetailModal({
  isOpen,
  onClose,
  studentId,
  subject,
  subtopicId,
  subtopicName,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  subject: string;
  subtopicId: string;
  subtopicName: string;
}) {
  const { showError } = useToast();
  const [attempts, setAttempts] = useState<AttemptDetail[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAttempts(null);
    fetch(`/api/xray/subtopic-detail/${encodeURIComponent(studentId)}?subject=${encodeURIComponent(subject)}&subtopicId=${encodeURIComponent(subtopicId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setAttempts(data.attempts ?? []))
      .catch(() => showError("Konu detayı yüklenemedi."));
  }, [isOpen, studentId, subject, subtopicId, showError]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={subtopicName} variant="center" widthClassName="max-w-lg">
      {!attempts ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      ) : attempts.length === 0 ? (
        <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Bu alt konu için henüz tamamlanmış bir test yok.</p>
      ) : (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {attempts.map((a) => (
            <AttemptRow key={a.attemptId} attempt={a} />
          ))}
        </div>
      )}
    </Modal>
  );
}
