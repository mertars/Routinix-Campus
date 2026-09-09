"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Lesson = { slot: string; subject: string; status: string; label: string };
type Day = { date: string; lessons: Lesson[]; absentCount: number; totalCount: number };
type Payload = {
  month: string;
  days: Day[];
  monthRate: number;
  overallRate: number;
  monthCounts: Record<string, number>;
};

const STATUS_COLOR: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  LATE: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  EXCUSED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  ABSENT: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Velinin en sık sorduğu soru: "çocuğum bugün derse geldi mi?"
//
// Panel eskiden yalnızca tek bir yüzde gösteriyordu; yüzde "dün
// gelmemiş" ile "üç haftadır gelmiyor"u aynı gösterir. Bu sekme günü
// güne, dersi derse gösterir.
export function ParentAttendanceTab({ studentId }: { studentId: string }) {
  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/parent/attendance/${studentId}?month=${month}`);
      setData(res.ok ? await res.json() : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [studentId, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const absentDays = data?.days.filter((d) => d.absentCount > 0) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div>
          <p className="text-xs text-espresso-muted dark:text-cream/40">Bu ay</p>
          <p className="text-2xl font-bold text-espresso dark:text-cream">%{data?.monthRate ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-espresso-muted dark:text-cream/40">Genel</p>
          <p className="text-2xl font-bold text-espresso dark:text-cream">%{data?.overallRate ?? "—"}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Önceki ay"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium text-espresso dark:text-cream">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label="Sonraki ay"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      )}

      {!loading && (!data || data.days.length === 0) && (
        <p className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-espresso-muted dark:border-white/5 dark:bg-midnight-card/50 dark:text-cream/40">
          Bu ay için yoklama kaydı yok.
        </p>
      )}

      {/* Devamsızlık olan günler ÖNCE ve ayrı: veli listeyi taramak
          zorunda kalmasın. */}
      {!loading && absentDays.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-50 p-4 dark:bg-red-500/10">
          <p className="mb-2 text-sm font-semibold text-red-800 dark:text-red-300">
            Bu ay {absentDays.length} gün devamsızlık var
          </p>
          <div className="space-y-1.5">
            {absentDays.map((d) => (
              <div key={d.date} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium text-espresso dark:text-cream">
                  {new Date(d.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}
                </span>
                <span className="text-espresso-muted dark:text-cream/40">
                  {d.absentCount}/{d.totalCount} derse katılmadı
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && data && data.days.length > 0 && (
        <div className="space-y-2">
          {data.days.map((d) => (
            <div
              key={d.date}
              className="rounded-xl border border-hairline bg-white p-3 dark:border-white/5 dark:bg-midnight-card/50"
            >
              <div className="mb-2 flex items-center gap-2">
                <CalendarCheck2 className="h-3.5 w-3.5 text-brand-600" />
                <span className="text-sm font-medium text-espresso dark:text-cream">
                  {new Date(d.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.lessons.map((l, i) => (
                  <span
                    key={`${l.slot}-${i}`}
                    className={cn("rounded-lg px-2 py-1 text-[11px] font-medium", STATUS_COLOR[l.status] ?? "bg-cream-card")}
                  >
                    {l.slot} · {l.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
