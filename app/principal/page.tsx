"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  GraduationCap,
  ScanLine,
  Megaphone,
  Radar,
  Settings2,
  Users,
  Building2,
  TrendingUp,
  AlertTriangle,
  UserCog,
  CalendarDays,
  Radio,
  NotebookPen,
  ClipboardCheck,
  Shuffle,
  Table2,
  Wand2,
  Trophy,
} from "lucide-react";
import { fetchDashboard } from "@/lib/client/fetch-dashboard";
import { type NavTab } from "@/components/principal/floating-nav";
import { DualFloatingNav } from "@/components/principal/dual-floating-nav";
import { SegmentSelector } from "@/components/principal/segment-selector";
import { PrincipalMobileNav } from "@/components/principal/principal-mobile-nav";
import { TopBar } from "@/components/principal/top-bar";
import { Hero } from "@/components/principal/hero";
import { StatCard } from "@/components/principal/stat-card";
import { ExecutiveOverviewTab } from "@/components/principal/tabs/executive-overview";
import { BranchStaffTab } from "@/components/principal/tabs/branch-staff";
import { LiveTutoringTab } from "@/components/principal/tabs/live-tutoring";
import { GuidanceProgramTab } from "@/components/principal/tabs/guidance-program";
import { OpticalUploadTab } from "@/components/principal/tabs/optical-upload";
import { AnnouncementsTab } from "@/components/principal/tabs/announcements";
import { TeacherPerformanceTab } from "@/components/principal/tabs/teacher-performance";
import { RiskRadarTab } from "@/components/principal/tabs/risk-radar";
import { CampusCalendarTab } from "@/components/principal/tabs/campus-calendar";
import { SystemSettingsTab } from "@/components/principal/tabs/system-settings";
import { AttendanceCommandTab } from "@/components/principal/tabs/attendance-command";
import { ExamSeatingTab } from "@/components/principal/tabs/exam-seating";
import { ScheduleMatrixTab } from "@/components/principal/tabs/schedule-matrix";
import { PreferenceRobotTab } from "@/components/principal/tabs/preference-robot";
import { AlumniNetworkTab } from "@/components/principal/tabs/alumni-network";
import { Modal } from "@/components/ui/modal";
import {
  StudentsListContent,
  BranchesListContent,
  CompletionBreakdownContent,
  RiskyStudentsContent,
} from "@/components/principal/modal-content";
import type { Segment } from "@/lib/mock-data";
import { useAdminProfile } from "@/lib/institution-scope";
import { useToast } from "@/lib/toast-context";

// Sol Ada: Akademik & Akış Modülleri — Sağ Ada: İdari & Yönetim Araçları
const TABS = [
  { id: "overview", label: "Genel Bakış", icon: LayoutDashboard, Component: ExecutiveOverviewTab, side: "left" },
  { id: "students", label: "Kullanıcı Yönetimi & Performans", icon: GraduationCap, Component: BranchStaffTab, side: "left" },
  { id: "upload", label: "Sınav & Optik Yükleme", icon: ScanLine, Component: OpticalUploadTab, side: "left" },
  { id: "exam-seating", label: "Kelebek Sınav Oturma Planı", icon: Shuffle, Component: ExamSeatingTab, side: "left" },
  { id: "live-tutoring", label: "Canlı Birebir Etüt & Randevu", icon: Radio, Component: LiveTutoringTab, side: "left" },
  { id: "guidance-program", label: "Rehberlik & A4 Program Yapıcı", icon: NotebookPen, Component: GuidanceProgramTab, side: "left" },
  { id: "attendance", label: "Günlük Yoklama & Devamsızlık", icon: ClipboardCheck, Component: AttendanceCommandTab, side: "left" },
  { id: "teachers", label: "Öğretmen Performansı", icon: UserCog, Component: TeacherPerformanceTab, side: "left" },
  { id: "preference-robot", label: "YKS / LGS Tercih Robotu", icon: Wand2, Component: PreferenceRobotTab, side: "right" },
  { id: "schedule-matrix", label: "Çakışmasız Ders Programı", icon: Table2, Component: ScheduleMatrixTab, side: "right" },
  { id: "campus", label: "Kampüs Pano & Toplu Duyuru", icon: Megaphone, Component: AnnouncementsTab, side: "right" },
  { id: "alumni", label: "Mezun Takip (Alumnus)", icon: Trophy, Component: AlumniNetworkTab, side: "right" },
  { id: "risk", label: "Risk Radarı", icon: Radar, Component: RiskRadarTab, side: "right" },
  { id: "calendar", label: "Etkinlik Takvimi", icon: CalendarDays, Component: CampusCalendarTab, side: "right" },
  { id: "settings", label: "Nudge & Sistem Ayarları", icon: Settings2, Component: SystemSettingsTab, side: "right" },
] as const satisfies readonly (NavTab & { Component: () => JSX.Element; side: "left" | "right" })[];

type TabId = (typeof TABS)[number]["id"];
const LEFT_TABS = TABS.filter((tab) => tab.side === "left");
const RIGHT_TABS = TABS.filter((tab) => tab.side === "right");

const STAT_MODALS = {
  students: { title: "Toplam Öğrenci", Content: StudentsListContent },
  branches: { title: "Aktif Şubeler", Content: BranchesListContent },
  completion: { title: "Aylık Görev Tamamlama", Content: CompletionBreakdownContent },
  risk: { title: "Riskli Öğrenciler", Content: RiskyStudentsContent },
} as const;

type StatModalId = keyof typeof STAT_MODALS;

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: -18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

type DashboardStats = { totalStudents: number; activeBranches: number; avgCompletion: number; riskyStudentCount: number };
const EMPTY_STATS: DashboardStats = { totalStudents: 0, activeBranches: 0, avgCompletion: 0, riskyStudentCount: 0 };

export default function PrincipalPage() {
  const { name: adminName, title: adminTitle } = useAdminProfile("Mert", "Kurum Müdürü");
  const { showError } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [statModal, setStatModal] = useState<StatModalId | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<Segment>("ALL");
  const ActiveComponent = TABS.find((tab) => tab.id === activeTab)?.Component ?? ExecutiveOverviewTab;
  const activeStatModal = statModal ? STAT_MODALS[statModal] : null;

  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  useEffect(() => {
    fetchDashboard<Partial<DashboardStats>>(String(selectedSegment))
      .then((data) =>
        setStats({
          totalStudents: data.totalStudents ?? 0,
          activeBranches: data.activeBranches ?? 0,
          avgCompletion: data.avgCompletion ?? 0,
          riskyStudentCount: data.riskyStudentCount ?? 0,
        })
      )
      .catch(() => showError("Panel istatistikleri yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSegment]);
  const { totalStudents, avgCompletion, riskyStudentCount } = stats;

  return (
    <div className="relative min-h-screen overflow-x-hidden dark:bg-transparent bg-cream">
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
      <PrincipalMobileNav leftTabs={LEFT_TABS} rightTabs={RIGHT_TABS} activeTab={activeTab} onSelect={(id) => setActiveTab(id as TabId)} />

      <TopBar />

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="relative z-10 mx-auto max-w-6xl">
        <motion.div variants={sectionVariants}>
          <Hero name={adminName} title={adminTitle} />
        </motion.div>

        <main className="px-4 pb-24 pt-2 sm:px-6 md:pb-10 md:pl-32 md:pr-32">
          <motion.div variants={sectionVariants} className="relative z-50 mb-6">
            <SegmentSelector selected={selectedSegment} onSelect={setSelectedSegment} />
          </motion.div>

          <motion.div variants={sectionVariants} className="mb-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedSegment}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
              >
                <StatCard
                  label="Toplam Öğrenci"
                  value={String(totalStudents)}
                  icon={Users}
                  tone="success"
                  pulse
                  onClick={() => setStatModal("students")}
                />
                <StatCard
                  label="Aktif Şubeler"
                  value={`${stats.activeBranches} Sınıf`}
                  icon={Building2}
                  tone="default"
                  onClick={() => setStatModal("branches")}
                />
                <StatCard
                  label="Aylık Görev Tamamlama"
                  value={`%${avgCompletion}`}
                  icon={TrendingUp}
                  tone="default"
                  progress={avgCompletion}
                  onClick={() => setStatModal("completion")}
                />
                <StatCard
                  label="Riskli Öğrenci Sayısı"
                  value={String(riskyStudentCount)}
                  icon={AlertTriangle}
                  tone="warning"
                  onClick={() => setStatModal("risk")}
                />
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div variants={sectionVariants}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${selectedSegment}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                {activeTab === "overview" ? (
                  <ExecutiveOverviewTab segment={selectedSegment} onNavigate={(id) => setActiveTab(id as TabId)} />
                ) : (
                  <ActiveComponent />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </main>
      </motion.div>

      <Modal isOpen={!!activeStatModal} onClose={() => setStatModal(null)} title={activeStatModal?.title ?? ""}>
        {activeStatModal && <activeStatModal.Content segment={selectedSegment} />}
      </Modal>
    </div>
  );
}
