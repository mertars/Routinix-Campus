"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FileBarChart, ArrowLeft, LogOut } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";
import { useLogout } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// Ölçme Değerlendirme (Hub'daki 3. modül) — diğer modüller gibi (bkz.
// xray-top-bar.tsx / video-top-bar.tsx'teki AYNI gerekçe) kendi görsel
// kimliğine sahip: zümrüt/yeşil vurgu — ERP'nin turuncusu, Röntgen'in
// mavisi ve Video'nun moruyla KARIŞMASIN diye dördüncü, ayırt edici bir
// renk.
export function OlcmeTopBar({ roleLabel }: { roleLabel: string }) {
  const router = useRouter();
  const logout = useLogout();
  const institutionName = useInstitutionName();

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-10"
    >
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <button
            onClick={() => router.push("/hub")}
            aria-label="Hub'a dön"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-2 rounded-2xl border border-emerald-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(16_185_129/0.25)] dark:border-emerald-500/20 dark:bg-midnight-card/50 md:flex">
            <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <span className={cn(spaceGrotesk.className, "whitespace-nowrap text-sm font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-700 shadow-sm backdrop-blur-sm dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300 md:px-3">
            <FileBarChart className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-[11px] font-semibold md:text-xs">Ölçme Değerlendirme</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300 lg:flex">
            <InstitutionBadgeIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">{institutionName}</span>
          </div>
          <span className="hidden text-xs font-medium text-espresso-muted dark:text-cream/40 lg:inline">{roleLabel}</span>
          <ThemeToggle />
          <button
            onClick={logout}
            aria-label="Çıkış yap"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/20 bg-red-500/5 text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300 md:w-auto md:gap-1.5 md:px-3"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline md:text-xs md:font-medium">Çıkış Yap</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
