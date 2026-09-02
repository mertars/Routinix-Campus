"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Scan, ArrowLeft, LogOut, ShieldAlert, TrendingDown, ListTodo, Users, LayoutGrid, ChevronDown } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";
import { useLogout } from "@/lib/role-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { DropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { XrayMonthlyScreeningPanel } from "@/components/xray/xray-monthly-screening-panel";
import { XrayInstitutionInsights } from "@/components/xray/xray-institution-insights";
import { XrayAssignmentTrackingDashboard } from "@/components/xray/xray-assignment-tracking-dashboard";
import { XrayBranchAveragePanel } from "@/components/xray/xray-branch-average-panel";
import { cn } from "@/lib/utils";

// Akademik Röntgen (Hub'daki 2. modül) — BİLEREK ERP'nin TopBar'ından ayrı
// bir bileşen. Hub'ın "3 ayrı modül" kurgusuna sadık kalmak için (bkz.
// app/hub/page.tsx) bu modül kendi görsel kimliğine sahip: sıcak turuncu
// marka rengi yerine SOĞUK mavi/camgöbeği ("röntgen filmi" hissi) — kurum
// rozetindeki turuncu vurgu (InstitutionBadgeIcon/logo) ile KARIŞMASIN diye
// bilinçli bir kontrast tercihi. Mobil/masaüstü için AYRI iki satır (bkz.
// principal/student/teacher top-bar.tsx'teki AYNI kurulmuş desen) — tek
// satırı küçültmeye/truncate'e güvenmek yerine dar ekranda ne göründüğü
// NET olsun diye.
//
// Kullanıcı geri bildirimi — "Unutma Testi", "En Zor Kazanımlar" ve "Ödev
// Takip" eskiden /xray/principal sayfasının içeriğinde HER ZAMAN görünen,
// üst kısmı kalabalıklaştıran ayrı bölümlerdi (+ Ödev Takip'in kendi
// tetikleyici butonu vardı). Artık ÜÇÜ DE bu üst barda birer menü öğesi —
// tıklanınca ortada açılan bir Modal olarak gösterilir, sayfa gövdesi
// sadece sonuç panelini içerir. Sadece principalTools=true iken gösterilir
// (öğretmen tarafında bu üç araç YOK — bkz. app/xray/teacher/page.tsx).
export function XrayTopBar({ roleLabel, principalTools = false }: { roleLabel: string; principalTools?: boolean }) {
  const router = useRouter();
  const logout = useLogout();
  const institutionName = useInstitutionName();
  const [screeningOpen, setScreeningOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [branchAverageOpen, setBranchAverageOpen] = useState(false);

  const tools = [
    { label: "Unutma Testi", icon: ShieldAlert, onClick: () => setScreeningOpen(true) },
    { label: "En Zor Kazanımlar", icon: TrendingDown, onClick: () => setInsightsOpen(true) },
    { label: "Şube Ortalamaları", icon: Users, onClick: () => setBranchAverageOpen(true) },
    { label: "Ödev Takip", icon: ListTodo, onClick: () => setTrackingOpen(true) },
  ];

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-40 border-b border-hairline bg-cream/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md dark:border-white/10 dark:bg-midnight/80 md:px-10"
    >
      <div className="mx-auto max-w-[1600px]">
        {/* Mobil düzen: geri + kompakt rozet + tema + çıkış (ikon-only) */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => router.push("/hub")}
              aria-label="Hub'a dön"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1.5 text-sky-700 shadow-sm backdrop-blur-sm dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300">
              <Scan className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate text-[11px] font-semibold">Röntgen</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <button
              onClick={logout}
              aria-label="Çıkış yap"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/20 bg-red-500/5 text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {/* Mobil araç menüsü — principalTools açıkken, TEK "Araçlar" tetikleyicisi
            (bkz. kullanıcı geri bildirimi: 4 ayrı pill çok kalabalıktı) */}
        {principalTools && (
          <div className="mt-2 md:hidden">
            <DropdownMenu
              align="left"
              trigger={
                <button className="flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-sky-700 shadow-sm backdrop-blur-sm dark:border-sky-400/20 dark:bg-midnight-card/50 dark:text-sky-300">
                  <LayoutGrid className="h-3.5 w-3.5" /> Araçlar <ChevronDown className="h-3 w-3" />
                </button>
              }
            >
              {tools.map((tool) => (
                <DropdownMenuItem key={tool.label} icon={tool.icon} label={tool.label} onClick={tool.onClick} />
              ))}
            </DropdownMenu>
          </div>
        )}

        {/* Masaüstü düzen */}
        <div className="hidden items-center justify-between gap-3 md:flex">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/hub")}
              aria-label="Hub'a dön"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-2xl border border-sky-500/30 bg-white/60 px-3 py-1.5 shadow-[0_0_15px_rgb(14_165_233/0.25)] dark:border-sky-500/20 dark:bg-midnight-card/50">
              <GlowLogo size="h-7 w-7" textSize="text-xs" innerClassName="bg-espresso dark:bg-midnight" />
              <span className={cn(spaceGrotesk.className, "whitespace-nowrap text-sm font-semibold text-espresso dark:text-cream")}>
                Routinix Kampüs
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sky-700 shadow-sm backdrop-blur-sm dark:border-sky-400/25 dark:bg-sky-400/10 dark:text-sky-300">
              <Scan className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Akademik Röntgen</span>
            </div>
          </div>

          {principalTools && (
            <DropdownMenu
              trigger={
                <button className="flex items-center gap-1.5 rounded-full border border-sky-500/25 bg-white/60 px-3.5 py-1.5 text-xs font-medium text-sky-700 shadow-sm backdrop-blur-sm transition hover:bg-sky-500/10 dark:border-sky-400/20 dark:bg-midnight-card/50 dark:text-sky-300 dark:hover:bg-sky-400/10">
                  <LayoutGrid className="h-3.5 w-3.5" /> Araçlar <ChevronDown className="h-3 w-3" />
                </button>
              }
            >
              {tools.map((tool) => (
                <DropdownMenuItem key={tool.label} icon={tool.icon} label={tool.label} onClick={tool.onClick} />
              ))}
            </DropdownMenu>
          )}

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 shadow-sm backdrop-blur-sm dark:text-brand-300">
              <InstitutionBadgeIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{institutionName}</span>
            </div>
            <span className="text-xs font-medium text-espresso-muted dark:text-cream/40">{roleLabel}</span>
            <ThemeToggle />
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
            >
              <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
            </button>
          </div>
        </div>
      </div>

      {principalTools && (
        <>
          <XrayMonthlyScreeningPanel isOpen={screeningOpen} onClose={() => setScreeningOpen(false)} />
          <XrayInstitutionInsights isOpen={insightsOpen} onClose={() => setInsightsOpen(false)} />
          <XrayBranchAveragePanel isOpen={branchAverageOpen} onClose={() => setBranchAverageOpen(false)} />
          <XrayAssignmentTrackingDashboard isOpen={trackingOpen} onClose={() => setTrackingOpen(false)} />
        </>
      )}
    </motion.header>
  );
}
