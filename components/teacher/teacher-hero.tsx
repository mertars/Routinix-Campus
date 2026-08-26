"use client";

import { motion } from "framer-motion";
import { useTeacherScope } from "@/lib/teacher-scope";
import { spaceGrotesk } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

export function TeacherHero({ name }: { name: string }) {
  const { subject, assignedBranches } = useTeacherScope();

  return (
    <div className="relative z-10 flex flex-col gap-2 px-4 pb-6 pt-8 md:px-32">
      <motion.p
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-xs font-medium uppercase tracking-[0.2em] text-espresso/50 dark:text-cream/40"
      >
        Öğretmen Paneli · {subject}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className={cn(spaceGrotesk.className, "text-5xl font-bold tracking-tight text-espresso dark:text-cream sm:text-6xl")}
      >
        {name}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="text-sm text-espresso-muted dark:text-cream/40"
      >
        Girdiğiniz sınıflar: {assignedBranches.map((branch) => branch.name).join(", ")}
      </motion.p>
    </div>
  );
}
