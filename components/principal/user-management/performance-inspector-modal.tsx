"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, CalendarCheck, FileCheck2, MessageSquareText, Download, Loader2, Rocket, Users, Gauge } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Target = { id: string; role: "STUDENT" | "TEACHER"; name: string } | null;

type StudentAnalytics = {
  role: "STUDENT";
  id: string;
  firstName: string;
  lastName: string;
  branchName: string;
  netTrend: { examName: string; subject: string; net: number }[];
  attendanceRate: number;
  homeworkSuccessRate: number | null;
  homeworkTotal: number;
  guidanceNotes: { id: string; category: string; note: string; createdAt: string }[];
};

type TeacherAnalytics = {
  role: "TEACHER";
  id: string;
  firstName: string;
  lastName: string;
  subject: string;
  branchNames: string[];
  classAverageNet: number | null;
  attendanceSubmissionCount: number;
  homeworkCount: number;
  quizCount: number;
  activityScore: number;
};

type Analytics = StudentAnalytics | TeacherAnalytics;

function NetTrendChart({ points }: { points: { examName: string; net: number }[] }) {
  const width = 320;
  const height = 100;
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => `${i * step},${height - ((p.net - min) / range) * (height - 20) - 10}`).join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible text-brand-600">
      <motion.polyline
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
      {points.map((p, i) => (
        <circle key={i} cx={i * step} cy={height - ((p.net - min) / range) * (height - 20) - 10} r={3} fill="currentColor" />
      ))}
    </svg>
  );
}

export function PerformanceInspectorModal({ target, onClose }: { target: Target; onClose: () => void }) {
  const { showError } = useToast();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!target) return;
    setAnalytics(null);
    setLoading(true);
    fetch(`/api/admin/users/${target.id}/analytics?role=${target.role}`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => showError("Performans verisi yüklenemedi."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  async function downloadReportCard() {
    if (!target) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/report-cards/${target.id}?donem=${encodeURIComponent("2025-2026 Güncel Dönem")}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/pdf")) {
        const data = contentType.includes("application/json") ? await res.json() : null;
        throw new Error(data?.error ?? "Karne oluşturulamadı.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${target.name.replace(/\s+/g, "-")}-gelisim-karnesi.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Karne oluşturulamadı.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal isOpen={!!target} onClose={onClose} title={target?.name ?? "Performans"} variant="center">
      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      )}

      {analytics?.role === "STUDENT" && (
        <div className="space-y-4">
          <p className="text-xs text-espresso-muted dark:text-cream/40">{analytics.branchName}</p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-cream-card p-3 text-center dark:bg-white/5">
              <CalendarCheck className="mx-auto mb-1 h-4 w-4 text-brand-600" />
              <p className="text-lg font-bold text-espresso dark:text-cream">%{analytics.attendanceRate}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Devam Oranı</p>
            </div>
            <div className="rounded-2xl bg-cream-card p-3 text-center dark:bg-white/5">
              <FileCheck2 className="mx-auto mb-1 h-4 w-4 text-brand-600" />
              <p className="text-lg font-bold text-espresso dark:text-cream">{analytics.homeworkSuccessRate === null ? "—" : `%${analytics.homeworkSuccessRate}`}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Ödev Başarısı ({analytics.homeworkTotal})</p>
            </div>
          </div>

          {analytics.netTrend.length > 0 ? (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
                <TrendingUp className="h-3.5 w-3.5 text-brand-600" /> Deneme Net Trendi
              </h3>
              <div className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
                <NetTrendChart points={analytics.netTrend} />
                <div className="mt-1 flex justify-between text-[9px] text-espresso-muted dark:text-cream/30">
                  {analytics.netTrend.map((p, i) => (
                    <span key={i}>{p.net}</span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz deneme sınavı verisi yok.</p>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
              <MessageSquareText className="h-3.5 w-3.5 text-brand-600" /> Öğretmen / Rehberlik Notları
            </h3>
            <div className="space-y-1.5">
              {analytics.guidanceNotes.map((note) => (
                <div key={note.id} className="rounded-lg bg-cream-card px-3 py-2 text-xs dark:bg-white/5">
                  <p className="text-espresso dark:text-cream">{note.note}</p>
                  <p className="mt-0.5 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(note.createdAt).toLocaleDateString("tr-TR")}</p>
                </div>
              ))}
              {analytics.guidanceNotes.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Not bulunmuyor.</p>}
            </div>
          </div>

          <button
            onClick={downloadReportCard}
            disabled={downloading}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Karne Oluşturuluyor..." : "Gelişim Karnesini PDF Olarak İndir"}
          </button>
        </div>
      )}

      {analytics?.role === "TEACHER" && (
        <div className="space-y-4">
          <p className="text-xs text-espresso-muted dark:text-cream/40">{analytics.subject} · {analytics.branchNames.join(", ") || "Danışman şube yok"}</p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-cream-card p-3 text-center dark:bg-white/5">
              <TrendingUp className="mx-auto mb-1 h-4 w-4 text-brand-600" />
              <p className="text-lg font-bold text-espresso dark:text-cream">{analytics.classAverageNet ?? "—"}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Sınıf Net Ortalaması</p>
            </div>
            <div className="rounded-2xl bg-cream-card p-3 text-center dark:bg-white/5">
              <Users className="mx-auto mb-1 h-4 w-4 text-brand-600" />
              <p className="text-lg font-bold text-espresso dark:text-cream">{analytics.attendanceSubmissionCount}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Girilen Yoklama</p>
            </div>
            <div className="rounded-2xl bg-cream-card p-3 text-center dark:bg-white/5">
              <FileCheck2 className="mx-auto mb-1 h-4 w-4 text-brand-600" />
              <p className="text-lg font-bold text-espresso dark:text-cream">{analytics.homeworkCount}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Atanan Ödev</p>
            </div>
            <div className="rounded-2xl bg-cream-card p-3 text-center dark:bg-white/5">
              <Rocket className="mx-auto mb-1 h-4 w-4 text-brand-600" />
              <p className="text-lg font-bold text-espresso dark:text-cream">{analytics.quizCount}</p>
              <p className="text-[10px] text-espresso-muted dark:text-cream/40">Pop-Quiz Sayısı</p>
            </div>
          </div>

          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
              <Gauge className="h-3.5 w-3.5 text-brand-600" /> Aktiflik Skoru
            </h3>
            <p className="mb-2 text-[10px] text-espresso-muted dark:text-cream/40">
              Gerçek bir anket/değerlendirme sistemi bulunmadığından, yoklama + ödev + quiz sıklığından türetilen şeffaf bir etkinlik göstergesidir.
            </p>
            <div className="h-2.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
              <motion.div
                className={cn("h-full rounded-full", analytics.activityScore >= 60 ? "bg-green-600" : "bg-brand-600")}
                initial={{ width: 0 }}
                animate={{ width: `${analytics.activityScore}%` }}
                transition={{ type: "spring", stiffness: 70, damping: 15 }}
              />
            </div>
            <p className="mt-1 text-right text-xs font-semibold text-espresso dark:text-cream">{analytics.activityScore}/100</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
