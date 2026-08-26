"use client";

import { motion } from "framer-motion";
import { useStudentScope } from "@/lib/student-scope";
import { spaceGrotesk } from "@/components/ui/aurora-brand";
import { ExamCountdownChip } from "@/components/student/exam-countdown-card";
import { cn } from "@/lib/utils";

const TRACK_SUBTITLE: Record<string, string> = {
  lgs: "LGS Hazırlık Süreci",
  yks: "YKS Hazırlık Süreci",
  genel: "Akademik Başarı Takibi",
};

export function StudentHero({ name }: { name: string }) {
  const { branchName, track } = useStudentScope();

  return (
    <div className="relative z-10 flex flex-col gap-6 px-4 pb-6 pt-8 md:flex-row md:items-center md:justify-between md:px-32">
      <div>
        <motion.p
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-xs font-medium uppercase tracking-[0.2em] text-espresso/50 dark:text-cream/40"
        >
          Öğrenci Paneli · {TRACK_SUBTITLE[track]}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className={cn(spaceGrotesk.className, "mt-2 text-5xl font-bold tracking-tight text-espresso dark:text-cream sm:text-6xl")}
        >
          {name}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-1 text-sm text-espresso-muted dark:text-cream/40"
        >
          Şubeniz: {branchName}
        </motion.p>
      </div>

      <ExamCountdownChip />
    </div>
  );
}
