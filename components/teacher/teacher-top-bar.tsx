"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Radio, Clock, Palette, LogOut } from "lucide-react";
import { useLogout } from "@/lib/role-context";
import { useTeacherScope, useCurrentLesson } from "@/lib/teacher-scope";
import { useHideOnScroll } from "@/lib/use-hide-on-scroll";
import { useInstitutionName } from "@/lib/institution-scope";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentPicker } from "@/components/principal/accent-picker";
import { TeacherAppearancePopup } from "@/components/teacher/teacher-appearance-popup";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

export function TeacherTopBar() {
  const handleLogout = useLogout();
  const institutionName = useInstitutionName();
  const { mySchedule } = useTeacherScope();
  const lesson = useCurrentLesson(mySchedule);
  const hidden = useHideOnScroll();
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);

  const lessonText = lesson.isLive
    ? `${lesson.branchName} · ${lesson.subject} (${lesson.slot})`
    : lesson.branchName
      ? `Sıradaki: ${lesson.branchName} · ${lesson.day} ${lesson.slot}`
      : "Şu an aktif ders yok";

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
                <InstitutionBadgeIcon className="h-3 w-3" />
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

          <div
            className={cn(
              "mt-2 flex items-center gap-1.5 truncate rounded-full px-3 py-1.5 text-[11px] font-semibold",
              lesson.isLive ? "bg-green-600 text-white shadow-sm" : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
            )}
          >
            {lesson.isLive ? (
              <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }} className="shrink-0">
                <Radio className="h-3.5 w-3.5" />
              </motion.span>
            ) : (
              <Clock className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate">{lessonText}</span>
          </div>
        </div>

        {/* Masaüstü düzen: değişmedi */}
        <div className="hidden items-center justify-between gap-3 md:flex">
          <div className="flex items-center justify-start gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
              <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
              <span className={cn(spaceGrotesk.className, "text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold",
                lesson.isLive
                  ? "bg-green-600 text-white shadow-sm"
                  : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
              )}
            >
              {lesson.isLive ? (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
                  <Radio className="h-3.5 w-3.5" />
                </motion.span>
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              {lesson.isLive
                ? `Şu Anki Ders: ${lesson.branchName} ${lesson.subject} (${lesson.slot})`
                : lesson.branchName
                  ? `Sıradaki Ders: ${lesson.branchName} · ${lesson.day} ${lesson.slot}`
                  : "Şu An Aktif Ders Yok"}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <AccentPicker />
            <ThemeToggle />
            <div className="flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
              <InstitutionBadgeIcon className="h-3.5 w-3.5" />
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

      <TeacherAppearancePopup isOpen={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />
    </motion.header>
  );
}
