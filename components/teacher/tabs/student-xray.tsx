"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Scan, TrendingUp, TrendingDown, Clock, CheckCircle2, AlertTriangle, LineChart, LifeBuoy, CheckCheck, Loader2, Download } from "lucide-react";
import { STUDENT_TOPIC_ANALYSIS, RISK_REASON_LABEL, type RiskReason } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { AvatarInitials } from "@/components/principal/avatar-initials";

type RosterStudent = { id: string; firstName: string; lastName: string; branchName: string };

type Analytics = {
  firstName: string;
  lastName: string;
  branchName: string;
  targetNet: number | null;
  weeklyStudyHours: number | null;
  attendanceRate: number;
  netTrend: { examName: string; subject: string; net: number }[];
  riskScore: number;
  riskReason: RiskReason;
};

export function StudentXrayTab() {
  const { teacherName, subject, assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [referring, setReferring] = useState(false);
  const [referred, setReferred] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (assignedBranches.length === 0) return;
    fetch(`/api/students?branchIds=${assignedBranches.map((b) => b.id).join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        const roster: RosterStudent[] = data.students ?? [];
        setStudents(roster);
        setSelectedId((current) => current || roster[0]?.id || "");
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches.map((b) => b.id).join(",")]);

  useEffect(() => {
    if (!selectedId) return;
    setAnalytics(null);
    setReferred(false);
    fetch(`/api/admin/users/${encodeURIComponent(selectedId)}/analytics?role=STUDENT`)
      .then((res) => res.json())
      .then((data) => setAnalytics(data))
      .catch(() => showError("Öğrenci verisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const analysis = STUDENT_TOPIC_ANALYSIS[selectedId] ?? [];
  const netTrend = (analytics?.netTrend ?? []).filter((n) => n.subject === subject);
  const maxNet = Math.max(...netTrend.map((p) => p.net), 1);

  async function referToGuidance() {
    if (!selectedId) return;
    setReferring(true);
    try {
      const res = await fetch("/api/guidance-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedId,
          authorName: teacherName,
          category: "ACADEMIC",
          confidentialityLevel: "RESTRICTED",
          note: "Öğretmen tarafından röntgen karnesi üzerinden tavsiye edildi.",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sevk gönderilemedi.");
      setReferred(true);
      setTimeout(() => setReferred(false), 2500);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sevk gönderilemedi.");
    } finally {
      setReferring(false);
    }
  }

  async function downloadReportCard() {
    if (!selectedId || !analytics) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/report-cards/${selectedId}?donem=${encodeURIComponent("2025-2026 Güncel Dönem")}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/pdf")) {
        const data = contentType.includes("application/json") ? await res.json() : null;
        throw new Error(data?.error ?? "Karne oluşturulamadı.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${analytics.firstName}-${analytics.lastName}-gelisim-karnesi.pdf`.replace(/\s+/g, "-");
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

  if (!analytics) {
    return <p className="text-xs text-espresso-muted dark:text-cream/40">Girdiğiniz sınıflarda gösterilecek öğrenci verisi yok.</p>;
  }

  const diff = (analytics.targetNet ?? 0) === 0 ? 0 : (netTrend.at(-1)?.net ?? 0) - (analytics.targetNet ?? 0);
  const isAbove = diff >= 0;

  return (
    <div className="space-y-4">
      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.firstName} {s.lastName} — {s.branchName}
          </option>
        ))}
      </select>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <div className="mb-4 flex items-center gap-3">
          <AvatarInitials name={`${analytics.firstName} ${analytics.lastName}`} className="h-12 w-12 text-base" />
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <Scan className="h-4 w-4 text-brand-600" /> {analytics.firstName} {analytics.lastName}
            </h2>
            <p className="text-xs text-espresso-muted dark:text-cream/40">{analytics.branchName}</p>
          </div>
          {analytics.riskScore >= 45 && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
              <AlertTriangle className="h-3 w-3" /> Risk {analytics.riskScore}
            </span>
          )}
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
            <p className={isAbove ? "flex items-center justify-center gap-1 text-lg font-bold text-green-600 dark:text-green-400" : "flex items-center justify-center gap-1 text-lg font-bold text-brand-600"}>
              {isAbove ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} {netTrend.at(-1)?.net ?? "—"}
            </p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">Net (Hedef {analytics.targetNet ?? "—"})</p>
          </div>
          <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-espresso dark:text-cream">
              <Clock className="h-4 w-4 text-brand-600" /> {analytics.weeklyStudyHours ?? "—"}
            </p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">Haftalık Çalışma (sa)</p>
          </div>
          <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
            <p className="flex items-center justify-center gap-1 text-lg font-bold text-espresso dark:text-cream">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> %{analytics.attendanceRate}
            </p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">Katılım</p>
          </div>
          <div className="rounded-xl bg-cream-card p-3 text-center dark:bg-white/5">
            <p className="text-lg font-bold text-espresso dark:text-cream">{RISK_REASON_LABEL[analytics.riskReason]}</p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">Risk Nedeni</p>
          </div>
        </div>

        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
          <LineChart className="h-3.5 w-3.5 text-brand-600" /> {subject} Net Trendi
        </h3>
        {netTrend.length > 0 ? (
          <div className="mb-5 flex items-end gap-2 rounded-xl bg-cream-card p-3 dark:bg-white/5" style={{ height: 96 }}>
            {netTrend.map((point, index) => (
              <div key={`${point.examName}-${index}`} className="flex flex-1 flex-col items-center gap-1">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(point.net / maxNet) * 64}px` }}
                  transition={{ type: "spring", stiffness: 80, damping: 16, delay: index * 0.08 }}
                  className="w-full rounded-t-md bg-brand-600"
                />
                <span className="text-[9px] text-espresso-muted dark:text-cream/40">{point.net}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-5 text-xs text-espresso-muted dark:text-cream/40">Bu ders için trend verisi yok.</p>
        )}

        <h3 className="mb-2 text-xs font-semibold text-espresso dark:text-cream">Konu Bazlı Başarı</h3>
        <div className="mb-5 space-y-3">
          {analysis.map((entry) => (
            <div key={entry.examName}>
              <p className="mb-1 text-[11px] font-medium text-espresso-muted dark:text-cream/50">{entry.examName}</p>
              {entry.hasTopicData ? (
                <div className="space-y-1.5">
                  {entry.topics?.map((topic) => (
                    <div key={topic.name}>
                      <div className="mb-0.5 flex items-center justify-between text-[10px]">
                        <span className="text-espresso-muted dark:text-cream/40">{topic.name}</span>
                        <span className="text-espresso-muted dark:text-cream/40">%{topic.successRate}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                        <motion.div
                          className="h-full rounded-full bg-brand-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${topic.successRate}%` }}
                          transition={{ type: "spring", stiffness: 70, damping: 15 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">Konu bazlı veri henüz yüklenmedi.</p>
              )}
            </div>
          ))}
          {analysis.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu öğrenci için deneme verisi yok.</p>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={referToGuidance}
            disabled={referred || referring}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-70 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {referring ? <Loader2 className="h-4 w-4 animate-spin" /> : referred ? <CheckCheck className="h-4 w-4" /> : <LifeBuoy className="h-4 w-4" />}
            {referred ? "İletildi" : "Rehberliğe Tavsiye Et"}
          </button>
          <button
            onClick={downloadReportCard}
            disabled={downloading}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-hairline text-sm font-semibold text-espresso transition hover:bg-cream-card disabled:opacity-70 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? "Hazırlanıyor..." : "PDF İndir"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
