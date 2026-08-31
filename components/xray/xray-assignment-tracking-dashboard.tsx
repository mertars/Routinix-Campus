"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Bell, AlertTriangle, CheckCircle2, Clock, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type TrackingRow = {
  id: string;
  testType: "genel" | "alt_konu" | "comprehension";
  studentId: string;
  studentName: string;
  branchName: string;
  grade: number;
  subtopicName: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "FLAGGED";
  assignedAt: string;
  completedAt: string | null;
  daysSinceAssigned: number;
};

const TEST_TYPE_LABEL: Record<TrackingRow["testType"], string> = { genel: "Genel Konu", alt_konu: "Alt Konu", comprehension: "Ne Kadar Anlamış" };
const STATUS_LABEL: Record<TrackingRow["status"], string> = { ASSIGNED: "Bekliyor", IN_PROGRESS: "Çözüyor", COMPLETED: "Tamamlandı", FLAGGED: "İhlal" };

type NotifyState = "idle" | "sending" | "sent" | "no-recipient" | "failed";

// Faz Z7 — attendance-command.tsx'teki NotifyButton'ın BİREBİR AYNI deseni:
// /api/notifications/send zaten var olan toplu bildirim altyapısını
// CUSTOM_ID_LIST kapsamıyla (tek öğrenci) kullanır, veliye gider (SMS
// onayı olmayan velilerde "no-recipient" durumuna düşer).
function RemindButton({ row }: { row: TrackingRow }) {
  const [state, setState] = useState<NotifyState>("idle");

  async function handleNotify() {
    setState("sending");
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeType: "CUSTOM_ID_LIST",
          scopeValue: row.studentId,
          templateBody: "Sayın {veli_adi}, öğrenciniz {ogrenci_adi} için atanan {test_adi} testi {gun_sayisi} gündür tamamlanmadı. Hatırlatmak isteriz.",
          extraParams: { test_adi: `${row.subtopicName} (${TEST_TYPE_LABEL[row.testType]})`, gun_sayisi: String(row.daysSinceAssigned) },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data?.error === "string" && data.error.includes("SMS onayı")) {
          setState("no-recipient");
          return;
        }
        throw new Error(data?.error ?? "Gönderilemedi.");
      }
      setState(data.recipientCount > 0 ? "sent" : "no-recipient");
    } catch {
      setState("failed");
    }
  }

  if (state === "no-recipient") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
        <AlertTriangle className="h-3 w-3" /> SMS onayı yok
      </span>
    );
  }
  if (state === "failed") {
    return (
      <button onClick={handleNotify} className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[10px] font-medium text-rose-700 transition hover:bg-rose-200 dark:bg-rose-500/15 dark:text-rose-300">
        <AlertTriangle className="h-3 w-3" /> Tekrar dene
      </button>
    );
  }

  return (
    <button
      onClick={handleNotify}
      disabled={state !== "idle"}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium transition disabled:cursor-default",
        state === "sent" ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
      )}
    >
      {state === "idle" && (
        <>
          <Bell className="h-3 w-3" /> Hatırlat
        </>
      )}
      {state === "sending" && <Loader2 className="h-3 w-3 animate-spin" />}
      {state === "sent" && (
        <>
          <CheckCircle2 className="h-3 w-3" /> Gönderildi
        </>
      )}
    </button>
  );
}

// Faz Z7 — kurum genelinde TÜM Röntgen atamalarının (Test 1 genel/alt_konu
// + Test 2) tek ekranda birleştirilmiş takibi. Mevcut atama panelleri
// sadece SEÇİLİ TEK öğrencinin geçmişini gösteriyordu — "kim ödevini
// yapmadı" sorusuna kurum genelinde cevap veren bir yer yoktu.
export function XrayAssignmentTrackingDashboard({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("pending");
  const [minDaysOverdue, setMinDaysOverdue] = useState(0);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TrackingRow[] | null>(null);
  const [totals, setTotals] = useState<{ total: number; pending: number; completed: number } | null>(null);

  const load = useCallback(() => {
    setRows(null);
    const params = new URLSearchParams({ subject });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (minDaysOverdue > 0) params.set("minDaysOverdue", String(minDaysOverdue));
    fetch(`/api/xray/assignment-tracking?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        setRows(data.rows ?? []);
        setTotals(data.totals ?? null);
      })
      .catch(() => showError("Atama takibi yüklenemedi."));
  }, [subject, statusFilter, minDaysOverdue, showError]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const filteredRows = (rows ?? []).filter((r) => !query.trim() || r.studentName.toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR")));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ödev Takip" variant="center" widthClassName="max-w-4xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <select value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream">
            {XRAY_SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="flex gap-1 rounded-lg bg-cream-card p-1 dark:bg-white/5">
            {(["pending", "completed", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                  statusFilter === f ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream" : "text-espresso-muted hover:text-espresso dark:text-cream/40"
                )}
              >
                {f === "pending" ? "Bekleyen" : f === "completed" ? "Tamamlanan" : "Tümü"}
              </button>
            ))}
          </div>
          {statusFilter === "pending" && (
            <select value={minDaysOverdue} onChange={(e) => setMinDaysOverdue(Number(e.target.value))} className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream">
              <option value={0}>Tüm süreler</option>
              <option value={1}>1+ gündür</option>
              <option value={2}>2+ gündür</option>
              <option value={3}>3+ gündür</option>
              <option value={7}>7+ gündür</option>
            </select>
          )}
          <div className="relative min-w-[140px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Öğrenci ara..."
              className="w-full rounded-lg border border-hairline bg-white py-1.5 pl-7 pr-2 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
        </div>

        {totals && (
          <div className="flex gap-3 text-[11px] text-espresso-muted dark:text-cream/40">
            <span>
              Toplam: <strong className="text-espresso dark:text-cream">{totals.total}</strong>
            </span>
            <span>
              Bekleyen: <strong className="text-amber-600 dark:text-amber-400">{totals.pending}</strong>
            </span>
            <span>
              Tamamlanan: <strong className="text-emerald-600 dark:text-emerald-400">{totals.completed}</strong>
            </span>
          </div>
        )}

        {!rows ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-xs text-espresso-muted dark:text-cream/40">Eşleşen atama yok.</p>
        ) : (
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {filteredRows.map((r) => {
              const isPending = r.status === "ASSIGNED" || r.status === "IN_PROGRESS";
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white/50 px-3 py-2 dark:border-white/10 dark:bg-midnight-card/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-espresso dark:text-cream">
                      {r.studentName} <span className="text-espresso-muted dark:text-cream/40">· {r.branchName}</span>
                    </p>
                    <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {TEST_TYPE_LABEL[r.testType]} — {r.subtopicName}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        r.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                          : r.status === "FLAGGED"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                            : "bg-cream-muted text-espresso-muted dark:bg-white/10 dark:text-cream/40"
                      )}
                    >
                      {isPending && <Clock className="h-3 w-3" />}
                      {STATUS_LABEL[r.status]}
                      {isPending && r.daysSinceAssigned > 0 && ` · ${r.daysSinceAssigned}g`}
                    </span>
                    {isPending && <RemindButton row={r} />}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
