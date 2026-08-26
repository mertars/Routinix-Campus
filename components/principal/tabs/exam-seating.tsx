"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, DoorOpen, IdCard, Loader2 } from "lucide-react";
import { INITIAL_BRANCHES, EXAM_HALLS } from "@/lib/mock-data";
import { ExamPrintModal, type PrintSeat } from "@/components/principal/exam/exam-print-modal";
import { useToast } from "@/lib/toast-context";
import { fetchDashboard } from "@/lib/client/fetch-dashboard";
import { cn } from "@/lib/utils";

const BRANCH_COLORS = [
  "bg-brand-100 text-brand-800 dark:bg-brand-600/20 dark:text-brand-300",
  "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300",
];

type ServerSeat = PrintSeat & { branchIndex: number };

export function ExamSeatingTab() {
  const { showError } = useToast();
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(["10a", "11a", "12a"]);
  const [hall, setHall] = useState<string>(EXAM_HALLS[0]);
  const [examName, setExamName] = useState("YKS Genel Deneme-5");
  const [examDate, setExamDate] = useState("22 Ağustos 2026");
  const [isShuffling, setIsShuffling] = useState(false);
  const [seats, setSeats] = useState<ServerSeat[] | null>(null);
  const [entrySeat, setEntrySeat] = useState<PrintSeat | null>(null);
  const [isDoorListOpen, setIsDoorListOpen] = useState(false);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchDashboard<{ branches?: { id: string; studentCount: number }[] }>("ALL")
      .then((data) => {
        const counts: Record<string, number> = {};
        (data.branches ?? []).forEach((b) => (counts[b.id] = b.studentCount));
        setStudentCounts(counts);
      })
      .catch(() => {
        // sessiz — çipler öğrenci sayısı olmadan gösterilir
      });
  }, []);

  function toggleBranch(id: string) {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function runAlgorithm() {
    if (selectedBranchIds.length < 2) return;
    setIsShuffling(true);
    setSeats(null);
    try {
      const res = await fetch("/api/admin/exam-seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examName, examDate, hall, branchIds: selectedBranchIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Oturma planı oluşturulamadı.");
      setSeats(
        data.seats.map((s: { seatNumber: number; studentName: string; branchName: string; branchIndex: number }) => ({
          seatNumber: s.seatNumber,
          studentName: s.studentName,
          branchName: s.branchName,
          branchIndex: s.branchIndex,
        }))
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Oturma planı oluşturulamadı.");
    } finally {
      setIsShuffling(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Kelebek Sınav Oturum Simülasyonu</h2>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <input
            value={examName}
            onChange={(event) => setExamName(event.target.value)}
            placeholder="Sınav adı"
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <input
            value={examDate}
            onChange={(event) => setExamDate(event.target.value)}
            placeholder="Tarih"
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <select
            value={hall}
            onChange={(event) => setHall(event.target.value)}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {EXAM_HALLS.map((hallName) => (
              <option key={hallName} value={hallName}>
                {hallName}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-2 text-xs font-medium text-espresso-muted dark:text-cream/40">
          Karıştırılacak şubeleri seçin (yan yana gelmemesi için en az 2 şube gerekir)
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {INITIAL_BRANCHES.map((branch) => (
            <button
              key={branch.id}
              onClick={() => toggleBranch(branch.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                selectedBranchIds.includes(branch.id)
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-hairline text-espresso-muted hover:border-brand-600/50 dark:border-white/10 dark:text-cream/40"
              )}
            >
              {branch.name} · {studentCounts[branch.id] ?? "—"} öğrenci
            </button>
          ))}
        </div>

        <button
          onClick={runAlgorithm}
          disabled={selectedBranchIds.length < 2 || isShuffling}
          className="flex items-center gap-2 rounded-lg bg-espresso px-4 py-2 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {isShuffling ? (
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
              <Loader2 className="h-3.5 w-3.5" />
            </motion.span>
          ) : (
            <Shuffle className="h-3.5 w-3.5" />
          )}
          {isShuffling ? "Kelebek Algoritması Çalışıyor..." : "Kelebek Algoritmasını Çalıştır ve Kaydet"}
        </button>
      </motion.div>

      <AnimatePresence>
        {seats && seats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-espresso dark:text-cream">
                Oturma Planı — {hall} ({seats.length} koltuk)
              </h2>
              <button
                onClick={() => setIsDoorListOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <DoorOpen className="h-3.5 w-3.5" /> Salon Kapı Listesi Yazdır
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {seats.map((seat, index) => (
                <motion.button
                  key={seat.seatNumber}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.025 }}
                  whileHover={{ scale: 1.05, y: -2 }}
                  onClick={() => setEntrySeat(seat)}
                  className={cn("rounded-xl p-2.5 text-left transition", BRANCH_COLORS[seat.branchIndex % BRANCH_COLORS.length])}
                >
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    <span>Koltuk {seat.seatNumber}</span>
                    <IdCard className="h-3 w-3" />
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold">{seat.studentName}</p>
                  <p className="truncate text-[10px] opacity-70">{seat.branchName}</p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ExamPrintModal
        isOpen={!!entrySeat}
        onClose={() => setEntrySeat(null)}
        mode="entry"
        hall={hall}
        examName={examName}
        examDate={examDate}
        seat={entrySeat ?? undefined}
      />
      <ExamPrintModal
        isOpen={isDoorListOpen}
        onClose={() => setIsDoorListOpen(false)}
        mode="doorList"
        hall={hall}
        examName={examName}
        examDate={examDate}
        seats={seats ?? []}
      />
    </div>
  );
}
