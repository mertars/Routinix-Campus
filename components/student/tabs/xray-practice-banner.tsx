"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";

type Assignment = { id: string; subtopicName: string; status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED" };

// Akademik Röntgen — Faz H: Test 1 "Konu Bilgisi" artık öğrenci kendi
// başına AÇAMIYOR — kullanıcı kararı: "öğrenci kafasına göre test
// almayacak, sadece yönetim üzerinden olacak". Bu bileşen yöneticinin
// atadığı bekleyen Test 1'leri gösterir — BİREBİR AYNI desen
// (xray-comprehension-banner.tsx), sadece kilitsiz tam ekrana yönlendirir.
export function XrayPracticeBanner() {
  const router = useRouter();
  const { studentId } = useStudentScope();
  const [pending, setPending] = useState<Assignment[]>([]);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/xray/practice-assignments?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => {
        const all: Assignment[] = data.assignments ?? [];
        setPending(all.filter((a) => a.status === "ASSIGNED" || a.status === "IN_PROGRESS"));
      })
      .catch(() => {});
  }, [studentId]);

  if (pending.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-sky-500/20 bg-sky-50 p-4 dark:border-sky-400/15 dark:bg-sky-500/10"
    >
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-sky-800 dark:text-sky-300">
        <BookOpen className="h-4 w-4" /> Sana atanmış bir konu bilgisi testi var
      </div>
      <div className="space-y-1.5">
        {pending.map((a) => (
          <button
            key={a.id}
            onClick={() => router.push(`/student/practice/${a.id}`)}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-2xl bg-white px-4 text-left text-sm font-medium text-espresso transition hover:bg-sky-100 dark:bg-midnight-card dark:text-cream dark:hover:bg-sky-500/10"
          >
            <span className="min-w-0 truncate">{a.subtopicName}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
