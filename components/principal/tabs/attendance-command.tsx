"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, X, Clock, Bell, Loader2, CheckCheck, Users } from "lucide-react";
import { type AttendanceStatus, type AttendanceRow } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  present: "bg-green-600 text-white",
  absent: "bg-rose-600 text-white",
  late: "bg-brand-600 text-white",
  unmarked: "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40",
};

type NotifyState = "idle" | "sending" | "sent";

function NotifyButton({ row }: { row: AttendanceRow }) {
  const [state, setState] = useState<NotifyState>("idle");

  function handleNotify() {
    setState("sending");
    setTimeout(() => setState("sent"), 1100);
  }

  return (
    <motion.button
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={handleNotify}
      disabled={state !== "idle"}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-default",
        state === "sent"
          ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
          : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
      )}
    >
      {state === "idle" && (
        <>
          <Bell className="h-3 w-3" /> SMS & Anlık Bildirim Gönder
        </>
      )}
      {state === "sending" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" /> Gönderiliyor...
        </>
      )}
      {state === "sent" && (
        <>
          <CheckCheck className="h-3 w-3" /> Veliye Ulaştı
        </>
      )}
    </motion.button>
  );
}

export function AttendanceCommandTab() {
  const { showError } = useToast();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/admin/attendance-today");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setRows(data.rows ?? []);
    } catch {
      showError("Yoklama verisi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(studentId: string, status: AttendanceStatus) {
    setRows((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
    try {
      const res = await fetch("/api/admin/attendance-today", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      showError("Durum kaydedilemedi, tekrar deneyin.");
      load();
    }
  }

  const counts = {
    present: rows.filter((row) => row.status === "present").length,
    late: rows.filter((row) => row.status === "late").length,
    absent: rows.filter((row) => row.status === "absent").length,
    unmarked: rows.filter((row) => row.status === "unmarked").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70">
          <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{counts.present}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Geldi</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70">
          <p className="text-2xl font-semibold text-brand-600">{counts.late}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Geç Kaldı</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70">
          <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">{counts.absent}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Gelmedi</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70">
          <p className="text-2xl font-semibold text-espresso dark:text-cream">{counts.unmarked}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">İşaretlenmedi</p>
        </div>
      </div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Users className="h-4 w-4 text-brand-600" /> Bugünkü Yoklama Matrisi
        </h2>
        <div className="space-y-2">
          {rows.map((row, index) => (
            <motion.div
              key={row.studentId}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
            >
              <div className="min-w-[140px]">
                <p className="text-sm font-medium text-espresso dark:text-cream">{row.studentName}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{row.branch}</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setStatus(row.studentId, "present")}
                  className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition", STATUS_STYLES.present, row.status !== "present" && "opacity-40 hover:opacity-100")}
                >
                  <Check className="h-3 w-3" /> Geldi
                </button>
                <button
                  onClick={() => setStatus(row.studentId, "late")}
                  className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition", STATUS_STYLES.late, row.status !== "late" && "opacity-40 hover:opacity-100")}
                >
                  <Clock className="h-3 w-3" /> Geç Kaldı
                </button>
                <button
                  onClick={() => setStatus(row.studentId, "absent")}
                  className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition", STATUS_STYLES.absent, row.status !== "absent" && "opacity-40 hover:opacity-100")}
                >
                  <X className="h-3 w-3" /> Gelmedi
                </button>
              </div>

              <div className="flex min-w-[190px] justify-end">
                {(row.status === "absent" || row.status === "late") && <NotifyButton key={row.studentId + row.status} row={row} />}
              </div>
            </motion.div>
          ))}
          {!loading && rows.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Kayıtlı öğrenci bulunamadı.</p>}
        </div>
      </motion.div>
    </div>
  );
}
