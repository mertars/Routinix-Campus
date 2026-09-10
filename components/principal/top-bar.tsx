"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Menu, LogOut, GraduationCap } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";
import { useLogout } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentPicker } from "@/components/principal/accent-picker";
import { MobileMenuPopup } from "@/components/principal/mobile-menu-popup";
import { ModuleSwitcher } from "@/components/ui/module-switcher";
import { CommandPaletteTrigger } from "@/components/ui/command-palette-trigger";
import { useInstitutionCounts } from "@/lib/institution-counts";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// Sol üstteki "hub'a dön" oku yerini ModuleSwitcher'a bıraktı (beş
// modülde birden). Ok, modül değiştirmeyi önce ÇIKMAYA çeviriyordu;
// panellerin ayrı sistemler gibi hissedilmesinin ana sebebi buydu.
export function TopBar() {
  const logout = useLogout();
  const institutionName = useInstitutionName();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const counts = useInstitutionCounts();

  return (
    <>
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-32"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        {/* Mobil düzen: sol geri tuşu + logo, sağda (küçülebilen) kurum rozeti + hamburger */}
        <div className="flex w-full items-center gap-2 md:hidden">
          <ModuleSwitcher current="erp" />
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
            <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <span className={cn(spaceGrotesk.className, "whitespace-nowrap text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
              <InstitutionBadgeIcon className="h-3.5 w-3.5" />
              <span className="truncate text-[10px] font-semibold">{institutionName}</span>
              {counts && (
                <span className="shrink-0 border-l border-brand-500/30 pl-1.5 text-[10px] font-semibold">
                  {counts.activeStudents}
                </span>
              )}
            </div>
            <CommandPaletteTrigger compact className="h-10 w-10" />
            <button
              onClick={() => setIsMenuOpen(true)}
              aria-label="Menüyü aç"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Masaüstü düzen: sol geri tuşu eklendi, gerisi değişmedi */}
        <div className="hidden items-center justify-start gap-3 md:flex">
          <ModuleSwitcher current="erp" />
          <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
            <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <span className={cn(spaceGrotesk.className, "text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
            <InstitutionBadgeIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{institutionName}</span>
          </div>

          {/* Aktif öğrenci sayısı HER ekranda görünür (madde 12): üst bar
              ERP'nin tüm sekmelerinde ortak. Sayı tek kaynaktan gelir,
              her ekran kendi hesabını yapmaz. */}
          {counts && (
            <div
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-white/60 px-3 py-1.5 text-espresso dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
              title={`${counts.activeStudents} aktif öğrenci · ${counts.activeTeachers} öğretmen · ${counts.branches} şube${counts.departedWithDebt > 0 ? ` · ${counts.departedWithDebt} ayrılmış öğrencinin borcu açık` : ""}`}
            >
              <GraduationCap className="h-3.5 w-3.5 text-brand-600" />
              <span className="text-xs font-semibold">{counts.activeStudents}</span>
              <span className="text-[10px] text-espresso-muted dark:text-cream/40">aktif öğrenci</span>
              {counts.departedWithDebt > 0 && (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                  +{counts.departedWithDebt} borçlu ayrılan
                </span>
              )}
            </div>
          )}
        </div>

        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
          <CommandPaletteTrigger />
          <AccentPicker />
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
          </button>
        </div>
      </div>
    </motion.header>
    <MobileMenuPopup isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}
