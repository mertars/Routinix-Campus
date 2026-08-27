"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, TrendingUp, CalendarCheck, AlertCircle, Loader2 } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";

export function ReportCardTab() {
  const { studentId, studentName, report } = useStudentScope();
  const { showError, showSuccess } = useToast();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function downloadPdf() {
    setStatus("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/report-cards/${studentId}?donem=${encodeURIComponent("2025-2026 Güncel Dönem")}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/pdf")) {
        const data = contentType.includes("application/json") ? await res.json() : null;
        throw new Error(data?.error ?? "Karne şu anda oluşturulamadı.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${studentName.replace(/\s+/g, "-")}-gelisim-karnesi.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatus("idle");
      showSuccess("Gelişim karnen indirildi!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Beklenmeyen bir hata oluştu.";
      setErrorMessage(message);
      setStatus("error");
      showError(message);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <FileText className="h-4 w-4 text-brand-600" /> Gelişim Karnesi Önizlemesi
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-cream-card p-4 dark:bg-white/5">
            <TrendingUp className="mb-1.5 h-4 w-4 text-brand-600" />
            <p className="text-lg font-bold text-espresso dark:text-cream">{report.actualNet}</p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">Güncel Net (Hedef: {report.targetNet})</p>
          </div>
          <div className="rounded-2xl bg-cream-card p-4 dark:bg-white/5">
            <CalendarCheck className="mb-1.5 h-4 w-4 text-brand-600" />
            <p className="text-lg font-bold text-espresso dark:text-cream">%{report.attendanceRate}</p>
            <p className="text-[10px] text-espresso-muted dark:text-cream/40">Devam Oranı</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-espresso-muted dark:text-cream/40">
          Bu önizleme; net, devam ve haftalık çalışma verilerinin kural bazlı bir özetidir. Tam rapor PDF olarak indirilebilir.
        </p>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <button
          onClick={downloadPdf}
          disabled={status === "loading"}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-70 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {status === "loading" ? "Karne Oluşturuluyor..." : "Gelişim Karnesini PDF Olarak İndir"}
        </button>
        {status === "error" && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {errorMessage} Lütfen daha sonra tekrar deneyin ya da sistem yöneticinize başvurun.
          </p>
        )}
      </motion.div>
    </div>
  );
}
