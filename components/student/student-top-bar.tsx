"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { GraduationCap, Palette, Sparkles } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { useStudentScope } from "@/lib/student-scope";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { INSTITUTION_NAME } from "@/lib/mock-data";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentPicker } from "@/components/principal/accent-picker";
import { StudentAppearancePopup } from "@/components/student/student-appearance-popup";

const TRACK_LABEL: Record<string, string> = { lgs: "LGS Adayı", yks: "YKS Adayı", genel: "Akademik Takip" };

export function StudentTopBar() {
  const router = useRouter();
  const { clearRole } = useRole();
  const { branchName, track } = useStudentScope();
  const hidden = useHideOnScroll();
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);

  function handleRoleChange() {
    clearRole();
    router.push("/");
  }

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: hidden ? "-100%" : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-32"
    >
      <div className="mx-auto max-w-6xl">
        {/* Mobil düzen: sadeleştirilmiş — logo, görünüm ayarı, kurum rozeti, Rol Değiştir */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-espresso text-xs font-bold text-cream dark:bg-brand-600">
              R
            </span>
            <div className="ml-auto flex min-w-0 items-center gap-1.5">
              <button
                onClick={() => setIsAppearanceOpen(true)}
                aria-label="Görünüm ayarları"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm dark:border-white/10 dark:bg-midnight-card/70 dark:text-cream"
              >
                <Palette className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-1 rounded-full bg-brand-500 px-2.5 py-1.5 text-white shadow-sm dark:bg-brand-600/90">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate text-[10px] font-semibold">{INSTITUTION_NAME}</span>
              </div>
              <button
                onClick={handleRoleChange}
                className="shrink-0 rounded-full border border-hairline px-2.5 py-1.5 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
              >
                Rol Değiştir
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-1.5 truncate rounded-full bg-cream-card px-3 py-1.5 text-[11px] font-semibold text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            <GraduationCap className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <span className="truncate">{branchName} · {TRACK_LABEL[track]}</span>
          </div>
        </div>

        {/* Masaüstü düzen */}
        <div className="hidden items-center justify-between gap-3 md:flex">
          <div className="flex items-center justify-start gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:bg-midnight-card/60">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-espresso text-xs font-bold text-cream dark:bg-brand-600">
                R
              </span>
              <span className="text-sm font-semibold text-espresso dark:text-cream">Routinix Kampüs</span>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-cream-card px-4 py-1.5 text-xs font-semibold text-espresso-muted dark:bg-white/5 dark:text-cream/40">
              <GraduationCap className="h-3.5 w-3.5 text-brand-600" />
              {branchName} · {TRACK_LABEL[track]}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <AccentPicker />
            <ThemeToggle />
            <div className="flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-white shadow-sm dark:bg-brand-600/90">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{INSTITUTION_NAME}</span>
            </div>
            <button
              onClick={handleRoleChange}
              className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            >
              Rol Değiştir
            </button>
          </div>
        </div>
      </div>

      <StudentAppearancePopup isOpen={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />
    </motion.header>
  );
}
