"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Palette, Sparkles, LogOut } from "lucide-react";
import { useLogout } from "@/lib/role-context";
import { useStudentScope } from "@/lib/student-scope";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { useInstitutionName } from "@/lib/institution-scope";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentPicker } from "@/components/principal/accent-picker";
import { StudentAppearancePopup } from "@/components/student/student-appearance-popup";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

const TRACK_LABEL: Record<string, string> = { lgs: "LGS Adayı", yks: "YKS Adayı", genel: "Akademik Takip" };

export function StudentTopBar() {
  const handleLogout = useLogout();
  const institutionName = useInstitutionName();
  const { branchName, track } = useStudentScope();
  const hidden = useHideOnScroll();
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: hidden ? "-100%" : 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-32"
    >
      <div className="mx-auto max-w-6xl">
        {/* Mobil düzen: sadeleştirilmiş — logo, görünüm ayarı, kurum rozeti, Rol Değiştir */}
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-2">
            <GlowLogo size="h-8 w-8" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <div className="ml-auto flex min-w-0 items-center gap-1.5">
              <button
                onClick={() => setIsAppearanceOpen(true)}
                aria-label="Görünüm ayarları"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
              >
                <Palette className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-center gap-1 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate text-[10px] font-semibold">{institutionName}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex shrink-0 items-center gap-1 rounded-full border border-red-400/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
              >
                <LogOut className="h-3 w-3" /> Çıkış Yap
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
            <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
              <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
              <span className={cn(spaceGrotesk.className, "text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-cream-card px-4 py-1.5 text-xs font-semibold text-espresso-muted dark:bg-white/5 dark:text-cream/40">
              <GraduationCap className="h-3.5 w-3.5 text-brand-600" />
              {branchName} · {TRACK_LABEL[track]}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <AccentPicker />
            <ThemeToggle />
            <div className="flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{institutionName}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
            </button>
          </div>
        </div>
      </div>

      <StudentAppearancePopup isOpen={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />
    </motion.header>
  );
}
