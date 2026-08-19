"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { SCHEDULE_DAYS, SCHEDULE_SLOTS, type ScheduleDay, type ScheduleSlot } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export type WeeklyGridCell = { label: string; tone: string } | null;

// Masaüstünde 5x4 tam matris grid, mobilde gün bazlı akordiyon — aynı
// 'getCell' veri kaynağından iki farklı yerleşim üretir.
export function WeeklyGrid({ getCell }: { getCell: (day: ScheduleDay, slot: ScheduleSlot) => WeeklyGridCell }) {
  const [expandedDay, setExpandedDay] = useState<ScheduleDay | null>(SCHEDULE_DAYS[0]);

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[560px] grid-cols-5 gap-2">
          {SCHEDULE_DAYS.map((day) => (
            <div key={day} className="space-y-2">
              <p className="text-center text-[11px] font-semibold text-espresso-muted dark:text-cream/40">{day}</p>
              {SCHEDULE_SLOTS.map((slot) => {
                const cell = getCell(day, slot);
                return (
                  <div
                    key={slot}
                    className={cn(
                      "flex min-h-[56px] flex-col justify-center rounded-xl border p-2 text-center",
                      cell ? cell.tone : "border-dashed border-hairline dark:border-white/10"
                    )}
                  >
                    <p className="text-[9px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/30">{slot}</p>
                    {cell ? (
                      <p className="truncate text-[10px] font-semibold text-espresso dark:text-cream">{cell.label}</p>
                    ) : (
                      <p className="text-[10px] text-espresso-muted/60 dark:text-cream/20">Boş</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2 md:hidden">
        {SCHEDULE_DAYS.map((day) => {
          const dayCells = SCHEDULE_SLOTS.map((slot) => ({ slot, cell: getCell(day, slot) }));
          const filledCount = dayCells.filter((c) => c.cell).length;
          const isExpanded = expandedDay === day;
          return (
            <div key={day} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
              <button
                onClick={() => setExpandedDay(isExpanded ? null : day)}
                className="flex min-h-[52px] w-full items-center justify-between px-3.5 text-left"
              >
                <span className="text-sm font-medium text-espresso dark:text-cream">{day}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] text-espresso-muted dark:text-cream/40">
                    {filledCount}/{dayCells.length}
                  </span>
                  <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
                </span>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1.5 px-3.5 pb-3.5">
                      {dayCells.map(({ slot, cell }) => (
                        <div
                          key={slot}
                          className={cn(
                            "flex min-h-[44px] items-center justify-between rounded-xl px-3 py-2",
                            cell ? cell.tone : "bg-white dark:bg-midnight-card"
                          )}
                        >
                          <span className="text-[11px] font-medium text-espresso-muted dark:text-cream/40">{slot}</span>
                          {cell ? (
                            <span className="text-xs font-semibold text-espresso dark:text-cream">{cell.label}</span>
                          ) : (
                            <span className="text-xs text-espresso-muted/60 dark:text-cream/20">Boş</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </>
  );
}
