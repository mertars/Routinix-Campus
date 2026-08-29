"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Menu, LogOut } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";
import { useLogout } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentPicker } from "@/components/principal/accent-picker";
import { MobileMenuPopup } from "@/components/principal/mobile-menu-popup";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

export function TopBar() {
  const logout = useLogout();
  const institutionName = useInstitutionName();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-32"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        {/* Mobil düzen: sol logo, sağda (küçülebilen) kurum rozeti + hamburger */}
        <div className="flex w-full items-center gap-2 md:hidden">
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
            <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <span className={cn(spaceGrotesk.className, "whitespace-nowrap text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[10px] font-semibold">{institutionName}</span>
            </div>
            <button
              onClick={() => setIsMenuOpen(true)}
              aria-label="Menüyü aç"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Masaüstü düzen: değişmedi */}
        <div className="hidden items-center justify-start gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:border-brand-500/20 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
            <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <span className={cn(spaceGrotesk.className, "text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{institutionName}</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
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
