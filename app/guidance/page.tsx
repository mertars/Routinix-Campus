"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BookMarked, CalendarClock, LifeBuoy, Users } from "lucide-react";
import { GuidanceTopBar } from "@/components/guidance/guidance-top-bar";
import { ReferralQueue } from "@/components/guidance/referral-queue";
import { StudentFocusTab } from "@/components/guidance/student-focus-tab";
import { RiskTab } from "@/components/guidance/risk-tab";
import { GuidanceMeetingsTab } from "@/components/guidance/meetings-tab";
import { GuidanceProgramTab } from "@/components/principal/tabs/guidance-program";
import { useDeepLinkTab } from "@/lib/use-deep-link-tab";
import { cn } from "@/lib/utils";

// REHBERLİK PANELİ.
//
// v1 tek ekrandı (yalnızca Sevk Kuyruğu) ve dosyanın kendi notu "birden
// fazla sekme gerektiğinde teacher/page.tsx'teki kendi kendini tanımlayan
// TABS dizisi deseni buraya da taşınır" diyordu — şimdi taşındı.
//
// ⚠️ 2026-09-15 denetiminin bulgusu: rehberlik rolünün API yetkileri
// vardı (görüşme notu yazma, risk radarı okuma) ama bunları yapabileceği
// EKRAN yoktu. İşi görüşme yapıp kayıt tutmak olan rolün kayıt tutacak
// yeri yoktu. Eklenen iki sekme tam olarak o boşluğu kapatır.
//
// Sekme sırası bilinçli: rehberlik panelini açan kişinin ilk sorusu
// "bana ne geldi" (sevkler), ikincisi "kiminle ilgilenmeliyim" (öğrenci
// takibi), üçüncüsü "kimi gözden kaçırıyorum" (risk radarı).
const TABS = [
  { id: "referrals", label: "Sevk Kuyruğu", icon: LifeBuoy },
  { id: "meetings", label: "Görüşme Takvimi", icon: CalendarClock },
  { id: "students", label: "Öğrenci Dosyası", icon: Users },
  // ⚠️ Bu ekran ZATEN vardı — ama YÖNETİCİ panelinde (bkz.
  // components/principal/tabs/guidance-program.tsx). Rehber öğretmen kendi
  // asli aracına, öğrenciye çalışma programı yazmaya, ulaşamıyordu
  // (Mert, 2026-09-15: "plan program oluşturamıyor"). Aynı bileşen burada
  // da render ediliyor; PDF çıktısı ve öğrencinin panelinde görünmesi
  // zaten çalışıyordu (bkz. components/student/tabs/guidance.tsx).
  { id: "program", label: "Çalışma Programı", icon: BookMarked },
  { id: "risk", label: "Risk Radarı", icon: AlertTriangle },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GuidancePage() {
  const [activeTab, setActiveTab] = useDeepLinkTab<TabId>("referrals", (v) => TABS.some((t) => t.id === v));
  // Risk radarından "Görüşme aç" denince Öğrenci Takibi'ne geçilir —
  // iki ekran arasındaki tek yönlü köprü.
  const [, setPendingStudentId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <GuidanceTopBar />

      <div className="mx-auto max-w-6xl px-4 py-5 md:px-8">
        {/* Sekme çubuğu — mobilde yatay kayar, dokunma hedefi 44px. */}
        <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition",
                  active
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/45 dark:hover:bg-white/5"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "referrals" && <ReferralQueue />}
            {activeTab === "meetings" && <GuidanceMeetingsTab />}
            {activeTab === "students" && <StudentFocusTab onNavigate={(tab) => setActiveTab(tab)} />}
            {activeTab === "program" && <GuidanceProgramTab />}
            {activeTab === "risk" && (
              <RiskTab
                onOpenStudent={(id) => {
                  setPendingStudentId(id);
                  setActiveTab("students");
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
