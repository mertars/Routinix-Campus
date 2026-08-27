"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Sparkles, LayoutGrid, MoveHorizontal } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Seat = { id: string; name: string };

export function SeatingWheelTab() {
  const { assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [winner, setWinner] = useState<Seat | null>(null);

  useEffect(() => {
    if (assignedBranches.length > 0 && !branchId) setBranchId(assignedBranches[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches]);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/seating-arrangement?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => setSeats(data.seats ?? []))
      .catch(() => showError("Oturma planı yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  async function persistOrder(nextSeats: Seat[]) {
    try {
      await fetch("/api/seating-arrangement", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchId, studentOrder: nextSeats.map((s) => s.id) }),
      });
    } catch {
      showError("Oturma düzeni kaydedilemedi.");
    }
  }

  function switchBranch(id: string) {
    setBranchId(id);
    setWinner(null);
    setSelectedIndex(null);
  }

  // Tıkla-Seç → Tıkla-Yerleştir: bir koltuğa dokunup seçin, sonra takas
  // edilecek ikinci koltuğa dokunun. Aynı etkileşim hem fare tıklamasında
  // hem dokunmatik ekranda çalışır — ayrı bir sürükle-bırak yolu gerekmiyor.
  function handleSeatTap(index: number) {
    if (selectedIndex === null) {
      setSelectedIndex(index);
      return;
    }
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }
    setSeats((prev) => {
      const next = [...prev];
      [next[selectedIndex], next[index]] = [next[index], next[selectedIndex]];
      persistOrder(next);
      return next;
    });
    setSelectedIndex(null);
  }

  function spinWheel() {
    if (seats.length === 0 || spinning) return;
    setSpinning(true);
    setWinner(null);
    let ticks = 0;
    const totalTicks = 18;

    function tick() {
      const random = seats[Math.floor(Math.random() * seats.length)];
      setHighlightId(random.id);
      ticks++;
      if (ticks < totalTicks) {
        const delay = 60 + ticks * 12;
        setTimeout(tick, delay);
      } else {
        const finalPick = seats[Math.floor(Math.random() * seats.length)];
        setHighlightId(finalPick.id);
        setWinner(finalPick);
        setSpinning(false);
      }
    }
    tick();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <LayoutGrid className="h-4 w-4 text-brand-600" /> Sınıf Oturma Planı
          </h2>
          <select
            value={branchId}
            onChange={(event) => switchBranch(event.target.value)}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {assignedBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mb-3 flex items-center gap-1.5 text-xs text-espresso-muted dark:text-cream/40">
          <MoveHorizontal className="h-3.5 w-3.5 shrink-0" />
          {selectedIndex === null
            ? "Yer değiştirmek için bir koltuğa dokunun."
            : `${seats[selectedIndex]?.name} seçildi — takas etmek için başka bir koltuğa dokunun.`}
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {seats.map((student, index) => (
            <button
              key={student.id}
              onClick={() => handleSeatTap(index)}
              className={cn(
                "min-h-[52px] rounded-xl border p-2.5 text-center text-xs font-medium transition active:scale-[0.97]",
                selectedIndex === index
                  ? "border-brand-600 bg-brand-600 text-white ring-2 ring-brand-600/40 ring-offset-2 ring-offset-white dark:ring-offset-midnight-card"
                  : highlightId === student.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-hairline bg-cream-card text-espresso hover:border-brand-600/40 dark:border-white/10 dark:bg-white/5 dark:text-cream"
              )}
            >
              {student.name}
            </button>
          ))}
          {seats.length === 0 && <p className="col-span-full text-xs text-espresso-muted dark:text-cream/40">Bu şubede öğrenci yok.</p>}
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="flex flex-col items-center rounded-3xl border border-hairline bg-white/70 p-5 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Sparkles className="h-4 w-4 text-brand-600" /> Öğrenci Çarkı
        </h2>
        <div className="mb-4 flex h-24 w-full items-center justify-center rounded-2xl bg-cream-card dark:bg-white/5">
          <AnimatePresence mode="wait">
            <motion.p
              key={highlightId ?? "idle"}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="px-3 text-lg font-bold text-espresso dark:text-cream"
            >
              {highlightId ? seats.find((s) => s.id === highlightId)?.name : "Hazır"}
            </motion.p>
          </AnimatePresence>
        </div>
        <button
          onClick={spinWheel}
          disabled={spinning || seats.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-espresso py-2.5 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <Shuffle className="h-3.5 w-3.5" /> {spinning ? "Çevriliyor..." : "Çarkı Çevir"}
        </button>
        {winner && !spinning && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-green-700 dark:text-green-400">
            🎉 Seçilen: {winner.name}
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
