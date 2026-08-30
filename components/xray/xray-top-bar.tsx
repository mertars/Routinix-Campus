"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Scan, ArrowLeft, LogOut } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";
import { useLogout } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// Akademik Röntgen (Hub'daki 2. modül) — BİLEREK ERP'nin TopBar'ından ayrı
// bir bileşen. Hub'ın "3 ayrı modül" kurgusuna sadık kalmak için (bkz.
// app/hub/page.tsx) bu modül kendi görsel kimliğine sahip: sıcak turuncu
// marka rengi yerine SOĞUK mavi/camgöbeği ("röntgen filmi" hissi) — kurum
// rozetindeki turuncu vurgu (InstitutionBadgeIcon/logo) ile KARIŞMASIN diye
// bilinçli bir kontrast tercihi.
export function XrayTopBar({ roleLabel }: { roleLabel: string }) {
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
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => router.push("/hub")}
            aria-label="Hub'a dön"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="hidden items-center gap-2 rounded-2xl border border-sky-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(14_165_233/0.25)] dark:border-sky-500/20 dark:bg-midnight-card/50 sm:flex">
            <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
            <span className={cn(spaceGrotesk.className, "whitespace-nowrap text-sm font-semibold text-espresso dark:text-cream")}>
              Routinix Kampüs
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sky-700 shadow-sm backdrop-blur-sm dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300">
            <Scan className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate text-xs font-semibold">Akademik Röntgen</span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden min-w-0 items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300 sm:flex">
            <InstitutionBadgeIcon className="h-3.5 w-3.5" />
            <span className="truncate text-xs font-semibold">{institutionName}</span>
          </div>
          <span className="hidden text-xs font-medium text-espresso-muted dark:text-cream/40 md:inline">{roleLabel}</span>
          <ThemeToggle />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Çıkış Yap</span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
