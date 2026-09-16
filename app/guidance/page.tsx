"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BookMarked, CalendarClock, LifeBuoy, Users } from "lucide-react";
import { GuidanceTopBar } from "@/components/guidance/guidance-top-bar";
import { ReferralQueue } from "@/components/guidance/referral-queue";
import { StudentFocusTab } from "@/components/guidance/student-focus-tab";
import { RiskTab } from "@/components/guidance/risk-tab";
import { GuidanceMeetingsTab } from "@/components/guidance/meetings-tab";
import { GuidanceProgramBuilder } from "@/components/guidance/program-builder";
import { useDeepLinkTab } from "@/lib/use-deep-link-tab";
import { cn } from "@/lib/utils";

// REHBERLİK PANELİ.
//
// ⚠️ 2026-09-15 denetiminin bulgusu: rehberlik rolünün API yetkileri
// vardı (görüşme notu yazma, risk radarı okuma) ama bunları yapabileceği
// EKRAN yoktu. İşi görüşme yapıp kayıt tutmak olan rolün kayıt tutacak
// yeri yoktu.
//
// ⚠️⚠️ ODAKLANILAN ÖĞRENCİ (Mert, 2026-09-16): "görüşme planla / plan
// oluştur gibi tuşlara basıldığında sadece sekmeye atıyor — sekmeye atıp
// o öğrencinin ekranını açmalı". Sekmeler arası geçişte öğrenci KAYBOLMAMALI;
// `focusStudentId` bu yüzden panelin kendisinde tutulur ve hedef sekmeye
// prop olarak iner. Aksi halde rehber, az önce baktığı öğrenciyi yeniden
// aramak zorunda kalıyordu.
const TABS = [
  { id: "referrals", label: "Sevk Kuyruğu", icon: LifeBuoy, hint: "Bana ne geldi" },
  { id: "meetings", label: "Görüşme Takvimi", icon: CalendarClock, hint: "Kimle ne zaman" },
  { id: "students", label: "Öğrenci Dosyası", icon: Users, hint: "Kiminle ilgilenmeliyim" },
  { id: "program", label: "Çalışma Programı", icon: BookMarked, hint: "Ne çalışacak" },
  { id: "risk", label: "Risk Radarı", icon: AlertTriangle, hint: "Kimi kaçırıyorum" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GuidancePage() {
  const [activeTab, setActiveTab] = useDeepLinkTab<TabId>("referrals", (v) => TABS.some((t) => t.id === v));
  // Sekmeler arası taşınan öğrenci — "bu öğrenciyle görüşme planla" dendiğinde
  // takvim sekmesi onu seçili açar.
  const [focusStudentId, setFocusStudentId] = useState<string | null>(null);

  function goTo(tab: TabId, studentId?: string) {
    if (studentId) setFocusStudentId(studentId);
    setActiveTab(tab);
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <GuidanceTopBar />

      <div className="mx-auto max-w-6xl px-4 py-5 md:px-8">
        {/* ⚠️ Sekme çubuğu yeniden tasarlandı (Mert: "üstten menü seçimi çok
            basit öbür arayüzlere göre"). Artık her sekme ne işe yaradığını
            da söylüyor (hint) ve aktif olan belirgin bir kart gibi duruyor —
            rehberlik panelini ilk açan biri hangi sekmenin ne olduğunu
            okumadan anlayamıyordu. Mobilde yatay kayar, dokunma hedefi 44px. */}
        <div className="-mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group relative flex min-h-[56px] shrink-0 items-center gap-2.5 overflow-hidden rounded-2xl border px-3.5 text-left transition",
                  active
                    ? "border-brand-500/60 bg-white shadow-md shadow-brand-600/10 dark:border-brand-500/40 dark:bg-midnight-card"
                    : "border-hairline bg-white/50 hover:border-brand-500/30 hover:bg-white dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                )}
              >
                {active && <span className="absolute inset-x-0 top-0 h-[3px] bg-brand-600" />}
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition",
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-cream-card text-espresso-muted group-hover:text-brand-600 dark:bg-white/5 dark:text-cream/40"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block whitespace-nowrap text-[13px] font-semibold",
                      active ? "text-espresso dark:text-cream" : "text-espresso-muted dark:text-cream/55"
                    )}
                  >
                    {tab.label}
                  </span>
                  <span className="block whitespace-nowrap text-[10.5px] text-espresso-muted/80 dark:text-cream/35">{tab.hint}</span>
                </span>
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
            {activeTab === "referrals" && (
              <ReferralQueue onOpenStudent={(id) => goTo("students", id)} onPlanMeeting={(id) => goTo("meetings", id)} />
            )}
            {activeTab === "meetings" && <GuidanceMeetingsTab initialStudentId={focusStudentId} />}
            {activeTab === "students" && (
              <StudentFocusTab focusStudentId={focusStudentId} onNavigate={(tab, studentId) => goTo(tab, studentId)} />
            )}
            {activeTab === "program" && <GuidanceProgramBuilder initialStudentId={focusStudentId} />}
            {activeTab === "risk" && (
              <RiskTab
                onOpenStudent={(id) => goTo("students", id)}
                // ⚠️ "Görüşme aç" ARTIK görüşme takvimine gidiyor (Mert:
                // "hem yanlış yere atıyor, görüşme açma değil öğrenci dosyası
                // ekranına atıyor") ve öğrenciyi de taşıyor.
                onPlanMeeting={(id) => goTo("meetings", id)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
