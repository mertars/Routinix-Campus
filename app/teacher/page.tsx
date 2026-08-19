"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  Zap,
  ListChecks,
  BookOpen,
  LayoutGrid,
  Rocket,
  Library,
  CalendarCheck,
  HelpCircle,
  Camera,
  Map,
  Scan,
  Puzzle,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { type NavTab } from "@/components/principal/floating-nav";
import { DualFloatingNav } from "@/components/principal/dual-floating-nav";
import { TeacherMobileNav } from "@/components/teacher/teacher-mobile-nav";
import { TeacherTopBar } from "@/components/teacher/teacher-top-bar";
import { TeacherHero } from "@/components/teacher/teacher-hero";
import { LiveAttendanceTab } from "@/components/teacher/tabs/live-attendance";
import { QuickHomeworkAssignerTab } from "@/components/teacher/tabs/quick-homework-assigner";
import { HomeworkCheckMatrixTab } from "@/components/teacher/tabs/homework-check-matrix";
import { ClassbookTab } from "@/components/teacher/tabs/classbook";
import { SeatingWheelTab } from "@/components/teacher/tabs/seating-wheel";
import { PopQuizTab } from "@/components/teacher/tabs/pop-quiz";
import { MaterialLibraryTab } from "@/components/teacher/tabs/material-library";
import { AppointmentApprovalTab } from "@/components/teacher/tabs/appointment-approval";
import { QuestionPoolTab } from "@/components/teacher/tabs/question-pool";
import { OpticalScannerTab } from "@/components/teacher/tabs/optical-scanner";
import { SuccessHeatmapTab } from "@/components/teacher/tabs/success-heatmap";
import { StudentXrayTab } from "@/components/teacher/tabs/student-xray";
import { GapClosingTab } from "@/components/teacher/tabs/gap-closing";
import { RiskReferralTab } from "@/components/teacher/tabs/risk-referral";
import { WeeklyScheduleTab } from "@/components/teacher/tabs/weekly-schedule";
import { useRole } from "@/lib/role-context";

// Sol Ada: Ders & Sınıf Operasyonu — Sağ Ada: Analiz & Etüt/İletişim
const TABS = [
  { id: "attendance", label: "Canlı Yoklama", icon: ClipboardCheck, Component: LiveAttendanceTab, side: "left" },
  { id: "quick-homework", label: "Gelişmiş Ödev Atama", icon: Zap, Component: QuickHomeworkAssignerTab, side: "left" },
  { id: "homework-matrix", label: "Ödev Kontrol Matrisi", icon: ListChecks, Component: HomeworkCheckMatrixTab, side: "left" },
  { id: "classbook", label: "Sınıf Defteri & Müfredat", icon: BookOpen, Component: ClassbookTab, side: "left" },
  { id: "seating", label: "Oturma Planı & Öğrenci Çarkı", icon: LayoutGrid, Component: SeatingWheelTab, side: "left" },
  { id: "pop-quiz", label: "Pop-Quiz Fırlatıcı", icon: Rocket, Component: PopQuizTab, side: "left" },
  { id: "materials", label: "Ders Materyali Kütüphanesi", icon: Library, Component: MaterialLibraryTab, side: "left" },
  { id: "appointments", label: "Etüt & Randevu Onayı", icon: CalendarCheck, Component: AppointmentApprovalTab, side: "right" },
  { id: "question-pool", label: "Soru Çözüm Havuzu", icon: HelpCircle, Component: QuestionPoolTab, side: "right" },
  { id: "scanner", label: "Mobil Optik Okuyucu", icon: Camera, Component: OpticalScannerTab, side: "right" },
  { id: "heatmap", label: "Başarı Isı Haritası", icon: Map, Component: SuccessHeatmapTab, side: "right" },
  { id: "xray", label: "Akademik Röntgen Karnesi", icon: Scan, Component: StudentXrayTab, side: "right" },
  { id: "gap-closing", label: "Eksik Kapatma", icon: Puzzle, Component: GapClosingTab, side: "right" },
  { id: "risk-referral", label: "Rehberlik Sevk & Risk", icon: AlertTriangle, Component: RiskReferralTab, side: "right" },
  { id: "weekly-schedule", label: "Haftalık Program & Soru Bankası", icon: CalendarDays, Component: WeeklyScheduleTab, side: "right" },
] as const satisfies readonly (NavTab & { Component: () => JSX.Element; side: "left" | "right" })[];

type TabId = (typeof TABS)[number]["id"];
const LEFT_TABS = TABS.filter((tab) => tab.side === "left");
const RIGHT_TABS = TABS.filter((tab) => tab.side === "right");

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: -18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function TeacherPage() {
  const { persona } = useRole();
  const [activeTab, setActiveTab] = useState<TabId>("attendance");
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.Component ?? LiveAttendanceTab;

  return (
    <div className="relative min-h-screen bg-cream dark:bg-midnight">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[640px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/10 via-transparent to-transparent"
      />

      <DualFloatingNav
        leftTabs={LEFT_TABS}
        rightTabs={RIGHT_TABS}
        activeTab={activeTab}
        onSelect={(id) => setActiveTab(id as TabId)}
      />
      <TeacherMobileNav leftTabs={LEFT_TABS} rightTabs={RIGHT_TABS} activeTab={activeTab} onSelect={(id) => setActiveTab(id as TabId)} />

      <TeacherTopBar />

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 mx-auto max-w-6xl">
        <motion.div variants={sectionVariants}>
          <TeacherHero name={persona?.name ?? "İrfan Hoca"} />
        </motion.div>

        <main className="px-4 pb-28 pt-2 md:px-32 md:pb-10">
          <motion.div variants={sectionVariants}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <ActiveComponent />
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
}
