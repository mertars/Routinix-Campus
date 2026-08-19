"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Sparkles, Menu } from "lucide-react";
import { INSTITUTION_NAME } from "@/lib/mock-data";
import { useRole } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { AccentPicker } from "@/components/principal/accent-picker";
import { MobileMenuPopup } from "@/components/principal/mobile-menu-popup";

export function TopBar() {
  const router = useRouter();
  const { clearRole } = useRole();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-32"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        {/* Mobil düzen: sol logo, sağda (küçülebilen) kurum rozeti + hamburger */}
        <div className="flex w-full items-center gap-2 md:hidden">
          <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:bg-midnight-card/60">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-espresso text-xs font-bold text-cream dark:bg-brand-600">
              R
            </span>
            <span className="whitespace-nowrap text-sm font-semibold text-espresso dark:text-cream">Routinix Kampüs</span>
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5 rounded-full bg-brand-500 px-2.5 py-1.5 text-white shadow-sm dark:bg-brand-600/90">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[10px] font-semibold">{INSTITUTION_NAME}</span>
            </div>
            <button
              onClick={() => setIsMenuOpen(true)}
              aria-label="Menüyü aç"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm dark:border-white/10 dark:bg-midnight-card/70 dark:text-cream"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Masaüstü düzen: değişmedi */}
        <div className="hidden items-center justify-start gap-3 md:flex">
          <div className="flex items-center gap-2 rounded-2xl border border-brand-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(var(--brand-600)/0.3)] dark:bg-midnight-card/60">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-espresso text-xs font-bold text-cream dark:bg-brand-600">
              R
            </span>
            <span className="text-sm font-semibold text-espresso dark:text-cream">Routinix Kampüs</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-1.5 text-white shadow-sm dark:bg-brand-600/90">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{INSTITUTION_NAME}</span>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:gap-3 md:flex">
          <AccentPicker />
          <ThemeToggle />
          <button
            onClick={() => {
              clearRole();
              router.push("/");
            }}
            className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
          >
            Rol Değiştir
          </button>
        </div>
      </div>

      <MobileMenuPopup isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </motion.header>
  );
}
