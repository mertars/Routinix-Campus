"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Globe2, School, Users2, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type FeedQuestion = {
  id: string;
  subject: string;
  imageUrl: string;
  answerText: string | null;
  answeredAt: string | null;
  studentDisplayName: string;
  branchName: string;
  teacher: { firstName: string; lastName: string; subject: string };
};

// Kampüs V2 Part 4 — "Tüm Çözülen Sorular (Global)": kurumdaki (veya isteğe
// bağlı sadece kendi şubesindeki) TÜM öğretmen tarafından yanıtlanmış
// sorular tek bir akışta listelenir. Soruyu soran öğrencinin adı BİLEREK
// tam gösterilmiyor (bkz. app/api/questions/route.ts > toDisplayName) —
// kurum geneline açık bir akışta bu gereksiz bir sosyal ifşa olurdu.
export function GlobalQuestionFeed() {
  const { showError } = useToast();
  const [branchOnly, setBranchOnly] = useState(false);
  const [questions, setQuestions] = useState<FeedQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/questions?scope=global${branchOnly ? "&branchOnly=1" : ""}`)
      .then((res) => res.json())
      .then((data) => setQuestions(data.questions ?? []))
      .catch(() => showError("Global soru akışı yüklenemedi."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchOnly]);

  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <div className="flex gap-1.5 rounded-full border border-hairline bg-white/70 p-1 dark:border-white/10 dark:bg-midnight-card/50">
          <button
            onClick={() => setBranchOnly(false)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              !branchOnly ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <Globe2 className="h-3.5 w-3.5" /> Kurum Geneli
          </button>
          <button
            onClick={() => setBranchOnly(true)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              branchOnly ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <School className="h-3.5 w-3.5" /> Sınıfım
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-espresso-muted dark:text-cream/40" />
        </div>
      )}

      {!loading && questions.length === 0 && (
        <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
          {branchOnly ? "Sınıfında henüz çözülmüş bir soru yok." : "Kurumda henüz çözülmüş bir soru yok."}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {questions.map((q, index) => (
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 8) * 0.04 }}
            className="overflow-hidden rounded-2xl border border-hairline bg-white/70 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={q.imageUrl} alt={`${q.subject} sorusu`} className="max-h-52 w-full object-contain bg-cream-card dark:bg-white/5" />
            <div className="p-3.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-espresso dark:text-cream">{q.subject}</p>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-cream-card px-2 py-0.5 text-[10px] text-espresso-muted dark:bg-white/10 dark:text-cream/50">
                  <Users2 className="h-3 w-3" /> {q.studentDisplayName} · {q.branchName}
                </span>
              </div>
              {q.answerText && (
                <p className="mb-1.5 flex items-start gap-1.5 rounded-lg bg-green-50 px-2.5 py-2 text-xs text-green-700 dark:bg-green-500/10 dark:text-green-400">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {q.answerText}
                </p>
              )}
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">
                {q.teacher.firstName} {q.teacher.lastName} · {q.teacher.subject}
                {q.answeredAt && ` · ${new Date(q.answeredAt).toLocaleDateString("tr-TR")}`}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
