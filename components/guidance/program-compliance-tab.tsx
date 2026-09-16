"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarPlus,
  ClipboardCheck,
  FolderOpen,
  Loader2,
  PlayCircle,
  Scan,
  Search,
  Target,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// PROGRAM TAKİBİ — "yazdığım plana uyuldu mu?"
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "rehberliğin yaptığı planlara ne kadar
// uyulmuş onu görebileceği bir ekran tasarla". Program yazılıyor, öğrenci
// panelinde işaretleniyordu ama rehberlik bunu ancak tek tek dosya açarak
// görebiliyordu.
//
// Sıralama BİLEREK en düşük uyumdan başlar: bu ekranın sorusu "kim iyi
// gidiyor" değil, "kim planı uygulamıyor".

type Row = {
  studentId: string;
  studentName: string;
  branchName: string | null;
  programCount: number;
  total: number;
  done: number;
  percent: number | null;
  lastProgramAt: string;
  lastProgramLabel: string;
  byKind: Record<string, { total: number; done: number }>;
};

type Payload = {
  weeks: number;
  summary: { studentCount: number; programCount: number; totalBlocks: number; doneBlocks: number; percent: number | null };
  rows: Row[];
};

const KIND_META: Record<string, { label: string; icon: typeof Target }> = {
  QUESTION: { label: "Soru", icon: Target },
  TOPIC_STUDY: { label: "Konu", icon: BookOpen },
  VIDEO: { label: "Video", icon: PlayCircle },
  XRAY_TEST: { label: "Röntgen", icon: Scan },
};

const WEEK_OPTIONS = [2, 4, 8, 12];

function tone(percent: number | null): "good" | "warn" | "bad" | "neutral" {
  if (percent === null) return "neutral";
  if (percent >= 70) return "good";
  if (percent >= 40) return "warn";
  return "bad";
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function ProgramComplianceTab({
  onOpenStudent,
  onPlanMeeting,
}: {
  onOpenStudent: (studentId: string) => void;
  onPlanMeeting: (studentId: string) => void;
}) {
  const { showError } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [weeks, setWeeks] = useState(4);
  const [query, setQuery] = useState("");
  const [onlyBehind, setOnlyBehind] = useState(false);

  useEffect(() => {
    setData(null);
    fetch(`/api/guidance/program-compliance?weeks=${weeks}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => showError("Program takibi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return (data?.rows ?? []).filter(
      (r) =>
        (!onlyBehind || (r.percent ?? 0) < 50) &&
        (q.length === 0 ||
          r.studentName.toLocaleLowerCase("tr").includes(q) ||
          (r.branchName ?? "").toLocaleLowerCase("tr").includes(q))
    );
  }, [data, query, onlyBehind]);

  return (
    <div className="space-y-4">
      {/* ÖZET */}
      <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
              <ClipboardCheck className="h-4 w-4 text-brand-600" /> Program Takibi
            </h2>
            <p className="text-[11.5px] text-espresso-muted dark:text-cream/45">
              Yazdığınız çalışma programlarının ne kadarı gerçekten yapıldı. Video blokları en az %90 izlenince, röntgen
              blokları test çözülünce, soru ve konu blokları öğrenci işaretleyince &quot;yapıldı&quot; sayılır.
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={cn(
                  "min-h-[34px] rounded-full border px-3 text-[11.5px] font-medium transition",
                  weeks === w
                    ? "border-espresso bg-espresso text-cream dark:border-brand-500 dark:bg-brand-600 dark:text-white"
                    : "border-hairline bg-white/70 text-espresso-muted hover:border-brand-500/40 dark:border-white/10 dark:bg-white/5 dark:text-cream/55"
                )}
              >
                {w} hafta
              </button>
            ))}
          </div>
        </div>

        {data && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div
              className={cn(
                "rounded-2xl border p-3",
                tone(data.summary.percent) === "bad"
                  ? "border-rose-500/25 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-500/10"
                  : tone(data.summary.percent) === "warn"
                    ? "border-amber-500/25 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10"
                    : "border-emerald-500/25 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/10"
              )}
            >
              <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                {data.summary.percent !== null ? `%${data.summary.percent}` : "—"}
              </p>
              <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Genel uyum oranı</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                {data.summary.studentCount}
              </p>
              <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Program verilen öğrenci</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                {data.summary.programCount}
              </p>
              <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Yazılan program</p>
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                {data.summary.doneBlocks}/{data.summary.totalBlocks}
              </p>
              <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Yapılan blok</p>
            </div>
          </div>
        )}
      </div>

      {/* LİSTE */}
      <div className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOnlyBehind((v) => !v)}
            className={cn(
              "min-h-[34px] rounded-full border px-3 text-[11.5px] font-medium transition",
              onlyBehind
                ? "border-rose-500 bg-rose-500 text-white"
                : "border-hairline bg-white/70 text-espresso-muted hover:border-rose-400 dark:border-white/10 dark:bg-white/5 dark:text-cream/55"
            )}
          >
            Sadece geride kalanlar (%50 altı)
          </button>
          <div className="relative ml-auto min-w-[160px] flex-1 sm:max-w-[240px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="İsim veya şube ara..."
              className="min-h-[34px] w-full rounded-full border border-hairline bg-white/80 pl-8 pr-3 text-[12px] text-espresso outline-none transition focus:border-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-cream"
            />
          </div>
        </div>

        {data === null && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        )}

        <div className="space-y-2">
          {visible.map((row, i) => {
            const t = tone(row.percent);
            return (
              <motion.div
                key={row.studentId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 8) * 0.03 }}
                className="rounded-2xl border border-hairline bg-white px-3.5 py-3 transition hover:shadow-sm dark:border-white/10 dark:bg-midnight-card/60"
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-espresso dark:text-cream">{row.studentName}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                          t === "bad"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                            : t === "warn"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        )}
                      >
                        %{row.percent ?? 0}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                      {row.branchName ?? "Şubesiz"} · {row.done}/{row.total} blok · {row.programCount} program · son:{" "}
                      {row.lastProgramLabel} ({shortDate(row.lastProgramAt)})
                    </p>

                    <div className="mt-1.5 h-1.5 w-full max-w-[280px] overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          t === "bad" ? "bg-rose-500" : t === "warn" ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.max(2, row.percent ?? 0)}%` }}
                      />
                    </div>

                    {/* Blok türü kırılımı — "videoyu izliyor ama soru çözmüyor"
                        ayrımı, tek bir yüzdeyle asla görülemezdi. */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(row.byKind).map(([kind, v]) => {
                        const meta = KIND_META[kind] ?? { label: kind, icon: Target };
                        const Icon = meta.icon;
                        const full = v.done === v.total;
                        return (
                          <span
                            key={kind}
                            className={cn(
                              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums",
                              full
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : v.done === 0
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                  : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/50"
                            )}
                          >
                            <Icon className="h-3 w-3" /> {meta.label} {v.done}/{v.total}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      onClick={() => onPlanMeeting(row.studentId)}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-full bg-espresso px-3 text-[11px] font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                    >
                      <CalendarPlus className="h-3 w-3" /> Görüşme Planla
                    </button>
                    <button
                      onClick={() => onOpenStudent(row.studentId)}
                      className="flex min-h-[34px] items-center gap-1.5 rounded-full border border-hairline px-3 text-[11px] font-semibold text-espresso-muted transition hover:border-brand-500/40 hover:text-brand-600 dark:border-white/10 dark:text-cream/60"
                    >
                      <FolderOpen className="h-3 w-3" /> Dosya
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {data !== null && visible.length === 0 && (
            <p className="py-8 text-center text-xs text-espresso-muted dark:text-cream/40">
              {data.rows.length === 0
                ? `Son ${data.weeks} haftada hiç program yazılmamış.`
                : "Bu filtreyle eşleşen öğrenci yok."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
