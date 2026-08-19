"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Rocket,
  FileCheck2,
  CalendarCheck,
  Bell,
  TrendingUp,
  Scan,
  Puzzle,
  Camera,
  CalendarDays,
  Timer,
  HelpCircle,
  HeartHandshake,
  Hourglass,
  Compass,
  Ticket,
  FileText,
  UserCog,
} from "lucide-react";
import { type NavTab } from "@/components/principal/floating-nav";
import { DualFloatingNav } from "@/components/principal/dual-floating-nav";
import { StudentMobileNav } from "@/components/student/student-mobile-nav";
import { StudentTopBar } from "@/components/student/student-top-bar";
import { StudentHero } from "@/components/student/student-hero";
import { OverviewTab } from "@/components/student/tabs/overview";
import { PopQuizTab } from "@/components/student/tabs/pop-quiz";
import { HomeworkTab } from "@/components/student/tabs/homework";
import { EtutTab } from "@/components/student/tabs/etut";
import { AnnouncementsTab } from "@/components/student/tabs/announcements";
import { NetTrackerTab } from "@/components/student/tabs/net-tracker";
import { XrayTab } from "@/components/student/tabs/xray";
import { GapClosingTab } from "@/components/student/tabs/gap-closing";
import { OpticalScannerTab } from "@/components/student/tabs/optical-scanner";
import { WeeklyScheduleTab } from "@/components/student/tabs/weekly-schedule";
import { PomodoroTab } from "@/components/student/tabs/pomodoro";
import { AskQuestionTab } from "@/components/student/tabs/ask-question";
import { GuidanceTab } from "@/components/student/tabs/guidance";
import { ExamCountdownTab } from "@/components/student/tabs/exam-countdown";
import { TercihRobotuTab } from "@/components/student/tabs/tercih-robotu";
import { KelebekTab } from "@/components/student/tabs/kelebek";
import { ReportCardTab } from "@/components/student/tabs/report-card";
import { ProfileTab } from "@/components/student/tabs/profile";
import { useRole } from "@/lib/role-context";

const TABS = [
  { id: "overview", label: "Ana Sayfa", icon: Home, Component: OverviewTab, side: "left" },
  { id: "pop-quiz", label: "Pop-Quiz & Anlık Soru", icon: Rocket, Component: PopQuizTab, side: "left" },
  { id: "homework", label: "Ödev Masası & Teslim", icon: FileCheck2, Component: HomeworkTab, side: "left" },
  { id: "net-tracker", label: "Net & Derece Takipçisi", icon: TrendingUp, Component: NetTrackerTab, side: "left" },
  { id: "xray", label: "Röntgen Karnesi & Isı Haritası", icon: Scan, Component: XrayTab, side: "left" },
  { id: "gap-closing", label: "Eksik Kapatma & Soru Bankası", icon: Puzzle, Component: GapClosingTab, side: "left" },
  { id: "optical-scanner", label: "Optik Tarama & Çözüm Videoları", icon: Camera, Component: OpticalScannerTab, side: "left" },
  { id: "weekly-schedule", label: "Haftalık Program & Müfredat", icon: CalendarDays, Component: WeeklyScheduleTab, side: "left" },
  { id: "tercih-robotu", label: "Tercih Robotu", icon: Compass, Component: TercihRobotuTab, side: "left" },
  { id: "etut", label: "Birebir Etüt & Randevu", icon: CalendarCheck, Component: EtutTab, side: "right" },
  { id: "announcements", label: "Duyuru & Etkinlik Akışı", icon: Bell, Component: AnnouncementsTab, side: "right" },
  { id: "pomodoro", label: "Pomodoro & Günlük Hedef", icon: Timer, Component: PomodoroTab, side: "right" },
  { id: "ask-question", label: "Soru Sor & Soru Havuzu", icon: HelpCircle, Component: AskQuestionTab, side: "right" },
  { id: "guidance", label: "Rehberlik & Koçluk Talebi", icon: HeartHandshake, Component: GuidanceTab, side: "right" },
  { id: "exam-countdown", label: "Sınav Geri Sayımı & Motivasyon", icon: Hourglass, Component: ExamCountdownTab, side: "right" },
  { id: "kelebek", label: "Kelebek Sistemi Masa No", icon: Ticket, Component: KelebekTab, side: "right" },
  { id: "report-card", label: "Gelişim Karnesi (PDF)", icon: FileText, Component: ReportCardTab, side: "right" },
  { id: "profile", label: "Profil & Ayarlar", icon: UserCog, Component: ProfileTab, side: "right" },
] as const satisfies readonly (NavTab & { Component: (props: { onNavigate?: (tabId: string) => void }) => JSX.Element; side: "left" | "right" })[];

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

export default function StudentPage() {
  const { persona } = useRole();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.Component ?? OverviewTab;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-cream dark:bg-midnight">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[640px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand-500/10 via-transparent to-transparent"
      />

      <DualFloatingNav leftTabs={LEFT_TABS} rightTabs={RIGHT_TABS} activeTab={activeTab} onSelect={(id) => setActiveTab(id as TabId)} />
      <StudentMobileNav leftTabs={LEFT_TABS} rightTabs={RIGHT_TABS} activeTab={activeTab} onSelect={(id) => setActiveTab(id as TabId)} />

      <StudentTopBar />

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 mx-auto max-w-6xl">
        <motion.div variants={sectionVariants}>
          <StudentHero name={persona?.name ?? "Arslan"} />
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
                {activeTab === "overview" ? <OverviewTab onNavigate={(id) => setActiveTab(id as TabId)} /> : <ActiveComponent />}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </main>
      </motion.div>
    </div>
  );
}
