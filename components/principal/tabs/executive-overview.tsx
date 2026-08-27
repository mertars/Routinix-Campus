"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, ScanLine, Megaphone, Radar, type LucideIcon } from "lucide-react";
import type { Segment } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { fetchDashboard } from "@/lib/client/fetch-dashboard";
import { Modal } from "@/components/ui/modal";
import {
  BranchesListContent,
  StaffListContent,
  UploadSummaryContent,
  AnnouncementsListContent,
  RiskyStudentsContent,
} from "@/components/principal/modal-content";
import { LiveTeacherFeed } from "@/components/principal/live-teacher-feed";

type DashboardBranch = { id: string; name: string; completionRate: number };
type DashboardData = {
  branches: DashboardBranch[];
  staff: { id: string }[];
  riskyStudents: { id: string }[];
  latestExam: { name: string; examDate: string } | null;
  examNetTrend: { examName: string; target: number | null; actual: number }[];
};

const QUICK_CARDS_META: { id: string; label: string; icon: LucideIcon; Content: (props: { segment?: Segment }) => JSX.Element }[] = [
  { id: "branches", label: "Şubeler", icon: Building2, Content: BranchesListContent },
  { id: "staff", label: "Kadro Yönetimi", icon: Users, Content: StaffListContent },
  { id: "upload", label: "Deneme Yükleme", icon: ScanLine, Content: UploadSummaryContent },
  { id: "announcements", label: "Duyurular", icon: Megaphone, Content: AnnouncementsListContent },
  { id: "risk", label: "Risk Kutusu", icon: Radar, Content: RiskyStudentsContent },
];

export function ExecutiveOverviewTab({ segment = "ALL", onNavigate }: { segment?: Segment; onNavigate?: (tabId: string) => void } = {}) {
  const { showError } = useToast();
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [announcementCount, setAnnouncementCount] = useState(0);

  useEffect(() => {
    fetchDashboard<DashboardData>(String(segment))
      .then((json) => setData(json))
      .catch(() => showError("Genel bakış verisi yüklenemedi."));
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((json) => setAnnouncementCount((json.announcements ?? []).length))
      .catch(() => {
        // sessiz — sayaç 0 gösterir
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  const branches = data?.branches ?? [];
  const activeCard = QUICK_CARDS_META.find((card) => card.id === openModalId);

  const hints: Record<string, string> = {
    branches: `${branches.length} aktif sınıf`,
    staff: `${data?.staff?.length ?? 0} kişi`,
    upload: data?.latestExam ? `Son yükleme: ${data.latestExam.name}` : "Henüz yükleme yok",
    announcements: `${announcementCount} aktif duyuru`,
    risk: `${data?.riskyStudents?.length ?? 0} sevk bekleyen öğrenci`,
  };

  const examNetTrend = data?.examNetTrend ?? [];
  const maxNet = Math.max(...examNetTrend.map((r) => Math.max(r.actual, r.target ?? 0)), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {QUICK_CARDS_META.map((card, index) => (
          <motion.button
            key={card.id}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            // "Kadro" ve "Deneme Yükleme" kartları BİLEREK modal önizleme
            // açmaz, doğrudan gerçek sekmeye (bkz. app/principal/page.tsx >
            // TABS) götürür — "Kadro" için "students" (arama/filtre, kalem
            // ikonuyla düzenleme; küçük önizleme bunları hiç göstermiyordu,
            // kullanıcı asıl sekmeyi bulamıyordu), "Deneme Yükleme" için
            // "upload" (asıl PDF/elle-giriş sihirbazı burada — önizleme
            // sadece "son yükleme" özetini gösterip yeni bir sonuç girmenin
            // hiçbir yolunu sunmuyordu).
            onClick={() => {
              if (card.id === "staff" && onNavigate) onNavigate("students");
              else if (card.id === "upload" && onNavigate) onNavigate("upload");
              else setOpenModalId(card.id);
            }}
            className="flex flex-col items-start gap-2 rounded-2xl border border-hairline bg-white/70 p-4 text-left shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-600/15">
              <card.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-espresso dark:text-cream">{card.label}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">{hints[card.id]}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <motion.div
          whileHover={{ scale: 1.01, y: -3 }}
          className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
        >
          <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Şube Bazlı Ödev Tamamlama Karşılaştırması</h2>
          <div className="space-y-4">
            {branches.map((branch, index) => (
              <div key={branch.id}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-espresso dark:text-cream/80">{branch.name}</span>
                  <span className="text-espresso-muted dark:text-cream/40">%{branch.completionRate}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-espresso dark:bg-brand-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${branch.completionRate}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 14, delay: index * 0.08 }}
                  />
                </div>
              </div>
            ))}
            {branches.length === 0 && (
              <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte şube bulunamadı.</p>
            )}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.01, y: -3 }}
          className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
        >
          <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Deneme Bazlı Net Ortalaması</h2>
          <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
            Hedef çizgisi, öğrencilerin gerçek hedef net ortalamasıdır; gerçekleşen değer o denemedeki gerçek ortalama nettir.
          </p>
          <div className="space-y-5">
            {examNetTrend.map((row, index) => (
              <div key={row.examName}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-espresso dark:text-cream/80">{row.examName}</span>
                  <span className="text-espresso-muted dark:text-cream/40">
                    Hedef {row.target ?? "—"} · Gerçekleşen {row.actual}
                  </span>
                </div>
                <div className="relative h-2.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                  {row.target !== null && (
                    <div
                      className="absolute inset-y-0 rounded-full border-r-2 border-espresso/40 dark:border-cream/30"
                      style={{ width: `${Math.min(100, (row.target / maxNet) * 100)}%` }}
                    />
                  )}
                  <motion.div
                    className="h-full rounded-full bg-brand-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (row.actual / maxNet) * 100)}%` }}
                    transition={{ type: "spring", stiffness: 60, damping: 14, delay: index * 0.1 }}
                  />
                </div>
              </div>
            ))}
            {examNetTrend.length === 0 && (
              <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte henüz deneme sonucu yok.</p>
            )}
          </div>
        </motion.div>
      </div>

      <LiveTeacherFeed />

      <Modal isOpen={!!activeCard} onClose={() => setOpenModalId(null)} title={activeCard?.label ?? ""}>
        {activeCard && <activeCard.Content segment={segment} />}
      </Modal>
    </div>
  );
}
