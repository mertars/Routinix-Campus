"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";

type Assignment = { id: string; subtopicName: string; status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED" };

// Akademik Röntgen — öğretmenin/yöneticinin öğrenciye atadığı "Ne Kadar
// Anlamış" (Test 2) sınavlarını gösteren bildirim. SADECE ASSIGNED/
// IN_PROGRESS olanlar listelenir — tamamlanmış/işaretlenmiş olanlar
// öğrencinin tekrar girebileceği bir şey değil (bkz. kilitli sınav route'u,
// COMPLETED/FLAGGED bir atamaya erişim 409 döner).
export function XrayComprehensionBanner() {
  const router = useRouter();
  const { studentId } = useStudentScope();
  const [pending, setPending] = useState<Assignment[]>([]);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/xray/comprehension-assignments?studentId=${encodeURIComponent(studentId)}`)
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
      className="rounded-3xl border border-amber-400/30 bg-amber-50 p-4 dark:border-amber-400/20 dark:bg-amber-500/10"
    >
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
        <Lock className="h-4 w-4" /> Sana atanmış bir sınav var
      </div>
      <div className="space-y-1.5">
        {pending.map((a) => (
          <button
            key={a.id}
            onClick={() => router.push(`/student/comprehension/${a.id}`)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-2xl bg-white px-4 text-left text-sm font-medium text-espresso transition hover:bg-amber-100 dark:bg-midnight-card dark:text-cream dark:hover:bg-amber-500/10"
          >
            {a.subtopicName}
            <ArrowRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-amber-700/80 dark:text-amber-300/60">
        Sınav başladıktan sonra sekme değiştiremez, çıkamazsın — kesintisiz bir yerde çöz.
      </p>
    </motion.div>
  );
}
