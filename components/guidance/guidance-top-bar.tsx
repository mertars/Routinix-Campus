"use client";

import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { useLogout } from "@/lib/role-context";
import { useInstitutionName } from "@/lib/institution-scope";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// Rehberlik personasının kendi hafif kabuğu — Öğretmen'in ModuleSwitcher/
// CommandPaletteTrigger/ders-programı yüklü topbar'ının AKSİNE (bkz.
// components/teacher/teacher-top-bar.tsx): Rehberlik 5 modülden biri değil,
// tek amaçlı ayrı bir persona (bkz. lib/server/auth/jwt.ts'teki not),
// dolayısıyla modül değiştirme/komut paleti burada anlamsız.
export function GuidanceTopBar() {
  const handleLogout = useLogout();
  const institutionName = useInstitutionName();

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-32"
    >
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
          <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
          <span className={cn(spaceGrotesk.className, "truncate text-sm font-semibold text-espresso dark:text-cream")}>Rehberlik</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <div className="hidden items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300 sm:flex">
            <InstitutionBadgeIcon className="h-3.5 w-3.5" />
            <span className="max-w-[10rem] truncate text-xs font-semibold">{institutionName}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Çıkış Yap</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
