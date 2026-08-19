"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, LifeBuoy, CheckCircle2, FileSpreadsheet, Megaphone, Loader2 } from "lucide-react";
import { RISK_REASON_LABEL, type RiskReason, type Segment } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type DashboardStudent = { id: string; name: string; branch: string; actualNet: number | null };
type DashboardBranch = { id: string; name: string; advisorName: string | null; studentCount: number; completionRate: number };
type DashboardStaff = { id: string; name: string; subject: string; branchNames: string[] };
type DashboardRiskyStudent = { id: string; name: string; branch: string; riskScore: number; reason: RiskReason };
type DashboardResponse = {
  branches: DashboardBranch[];
  staff: DashboardStaff[];
  students: DashboardStudent[];
  riskyStudents: DashboardRiskyStudent[];
  latestExam: { name: string; examDate: string; resultCount: number } | null;
};

// Bu 5 modal (Şubeler, Kadro, Deneme Yükleme, Risk Kutusu, Öğrenci listesi)
// AYNI /api/admin/dashboard uç noktasını segment'e göre çeker — header'daki
// istatistik kartlarıyla ve "Genel Bakış" sekmesiyle birebir aynı sayıları
// gösterir (çelişkili veri riski yok).
function useDashboard(segment: Segment) {
  const { showError } = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/dashboard?segment=${encodeURIComponent(String(segment))}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => showError("Veri yüklenemedi."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment]);

  return { data, loading };
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
    </div>
  );
}

export function StudentsListContent({ segment = "ALL" }: { segment?: Segment }) {
  const { data, loading } = useDashboard(segment);
  if (loading) return <LoadingRow />;
  const students = data?.students ?? [];
  return (
    <div className="space-y-1.5">
      {students.map((student, index) => (
        <motion.div
          key={student.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: Math.min(index, 20) * 0.02 }}
          className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2 dark:bg-white/5"
        >
          <div>
            <p className="text-sm font-medium text-espresso dark:text-cream">{student.name}</p>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">{student.branch}</p>
          </div>
          <span className="text-xs font-medium text-brand-600">{student.actualNet ?? "—"} net</span>
        </motion.div>
      ))}
      {students.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte öğrenci bulunamadı.</p>}
    </div>
  );
}

export function BranchesListContent({ segment = "ALL" }: { segment?: Segment }) {
  const { data, loading } = useDashboard(segment);
  if (loading) return <LoadingRow />;
  const branches = data?.branches ?? [];
  return (
    <div className="space-y-1.5">
      {branches.map((branch, index) => (
        <motion.div
          key={branch.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-espresso dark:text-cream">{branch.name}</p>
            <span className="flex items-center gap-1 text-xs text-espresso-muted dark:text-cream/40">
              <Users className="h-3.5 w-3.5" /> {branch.studentCount}
            </span>
          </div>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">{branch.advisorName ?? "Danışman atanmadı"}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
            <motion.div
              className="h-full rounded-full bg-brand-600"
              initial={{ width: 0 }}
              animate={{ width: `${branch.completionRate}%` }}
              transition={{ type: "spring", stiffness: 70, damping: 15, delay: index * 0.06 }}
            />
          </div>
        </motion.div>
      ))}
      {branches.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte şube bulunamadı.</p>}
    </div>
  );
}

export function CompletionBreakdownContent({ segment = "ALL" }: { segment?: Segment }) {
  const { data, loading } = useDashboard(segment);
  if (loading) return <LoadingRow />;
  const branches = data?.branches ?? [];
  return (
    <div className="space-y-3">
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
      {branches.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte şube bulunamadı.</p>}
      <p className="pt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">
        Ödev tamamlama, o şubedeki öğrencilerin gerçek ödev teslim durumlarından (Tamamlandı / Toplam) hesaplanır.
      </p>
    </div>
  );
}

export function RiskyStudentsContent({ segment = "ALL" }: { segment?: Segment }) {
  const { data, loading } = useDashboard(segment);
  const { showError, showSuccess } = useToast();
  const [referred, setReferred] = useState<string[]>([]);
  const [referring, setReferring] = useState<string | null>(null);

  async function refer(entry: DashboardRiskyStudent) {
    setReferring(entry.id);
    try {
      const res = await fetch("/api/guidance-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: entry.id,
          authorName: "Yönetici",
          category: "ACADEMIC",
          confidentialityLevel: "RESTRICTED",
          note: "Risk kutusu üzerinden yönetici tarafından sevk edildi.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sevk gönderilemedi.");
      setReferred((prev) => [...prev, entry.id]);
      showSuccess(`${entry.name} rehberliğe sevk edildi.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sevk gönderilemedi.");
    } finally {
      setReferring(null);
    }
  }

  if (loading) return <LoadingRow />;
  const risky = data?.riskyStudents ?? [];

  return (
    <div className="space-y-2">
      {risky.map((entry, index) => {
        const isReferred = referred.includes(entry.id);
        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.06 }}
            className="flex items-center justify-between rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
          >
            <div>
              <p className="text-sm font-medium text-espresso dark:text-cream">{entry.name}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                {entry.branch} · {RISK_REASON_LABEL[entry.reason]} · Risk {entry.riskScore}
              </p>
            </div>
            <button
              onClick={() => refer(entry)}
              disabled={isReferred || referring === entry.id}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                isReferred
                  ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                  : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
              )}
            >
              {referring === entry.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isReferred ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Sevk Edildi
                </>
              ) : (
                <>
                  <LifeBuoy className="h-3 w-3" /> Rehberliğe Sevk Et
                </>
              )}
            </button>
          </motion.div>
        );
      })}
      {risky.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte risk uyarısı yok.</p>}
    </div>
  );
}

export function StaffListContent({ segment = "ALL" }: { segment?: Segment }) {
  const { data, loading } = useDashboard(segment);
  if (loading) return <LoadingRow />;
  const staff = data?.staff ?? [];
  return (
    <div className="space-y-1.5">
      {staff.map((member, index) => (
        <motion.div
          key={member.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
        >
          <p className="text-sm font-medium text-espresso dark:text-cream">{member.name}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">{member.subject}</p>
          <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">{member.branchNames.join(", ") || "Şube ataması yok"}</p>
        </motion.div>
      ))}
      {staff.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu segmentte kadro bulunamadı.</p>}
    </div>
  );
}

export function UploadSummaryContent({ segment = "ALL" }: { segment?: Segment } = {}) {
  const { data, loading } = useDashboard(segment);
  if (loading) return <LoadingRow />;
  const latestExam = data?.latestExam;

  return (
    <div className="space-y-3">
      {latestExam ? (
        <div className="flex items-center gap-3 rounded-xl bg-cream-card px-3 py-3 dark:bg-white/5">
          <FileSpreadsheet className="h-5 w-5 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium text-espresso dark:text-cream">{latestExam.name}</p>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              {new Date(latestExam.examDate).toLocaleDateString("tr-TR")} · {latestExam.resultCount} net sonucu işlendi
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz deneme sonucu yüklenmedi.</p>
      )}
      <p className="text-xs text-espresso-muted dark:text-cream/40">
        Yeni bir deneme sonucu yüklemek için sol menüden <span className="font-medium text-espresso dark:text-cream">Optik Yükleme</span> sekmesine geç.
      </p>
    </div>
  );
}

type AnnouncementSummary = { id: string; title: string; content: string };

export function AnnouncementsListContent({ segment: _segment = "ALL" }: { segment?: Segment } = {}) {
  const [announcements, setAnnouncements] = useState<AnnouncementSummary[]>([]);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => setAnnouncements(data.announcements ?? []))
      .catch(() => {
        // sessiz — liste boş görünür
      });
  }, []);

  return (
    <div className="space-y-2">
      {announcements.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.06 }}
          className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
        >
          <div className="flex items-center gap-2">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <p className="text-sm font-medium text-espresso dark:text-cream">{item.title}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">{item.content}</p>
        </motion.div>
      ))}
      {announcements.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz duyuru yayınlanmadı.</p>}
    </div>
  );
}
