"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp, TrendingDown, Minus, Trophy, Target } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { StudentAnalytics } from "./types";

// Öğrenciye özel analiz — kullanıcı talebi: "şubelere özel ve öğrenciye
// özel paneller". Bir öğrencinin deneme deneme gidişatı, her denemedeki
// ders kırılımı ve sırası, ders ortalamaları ve kişisel zayıf kazanımları.
export function StudentAnalyticsModal({
  studentId,
  categoryId,
  onClose,
}: {
  studentId: string;
  categoryId: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<StudentAnalytics | null>(null);

  useEffect(() => {
    setData(null);
    const qs = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : "";
    fetch(`/api/olcme/analytics/student/${studentId}${qs}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [studentId, categoryId]);

  const title = data ? `${data.student.firstName} ${data.student.lastName}` : "Öğrenci Analizi";

  return (
    <Modal isOpen onClose={onClose} title={title} widthClassName="max-w-3xl">
      {!data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : data.sessions.length === 0 ? (
        <p className="py-12 text-center text-[11px] text-espresso-muted dark:text-cream/40">Bu klasörde öğrencinin deneme sonucu yok.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            {data.student.branchName} · No: {data.student.studentNumber} · {data.sessions.length} deneme
          </p>

          {/* Deneme deneme gidişat */}
          <div className="overflow-hidden rounded-xl border border-hairline dark:border-white/10">
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 z-10 bg-cream-card text-left text-[9.5px] uppercase tracking-wide text-espresso-muted dark:bg-midnight-card dark:text-cream/40">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Deneme</th>
                    <th className="px-3 py-2 text-right font-semibold">Sıra</th>
                    <th className="px-3 py-2 text-right font-semibold">Toplam Net</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.sessions].reverse().map((s, i, arr) => {
                    const prev = arr[i + 1];
                    const delta = prev ? Math.round((s.totalNet - prev.totalNet) * 100) / 100 : null;
                    const Icon = delta === null || Math.abs(delta) < 0.5 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
                    const toneClass =
                      delta === null || Math.abs(delta) < 0.5
                        ? "text-espresso-muted dark:text-cream/40"
                        : delta > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400";
                    return (
                      <tr key={s.sessionId} className="border-t border-hairline align-top dark:border-white/10">
                        <td className="px-3 py-2.5">
                          <span className="block font-medium text-espresso dark:text-cream">{s.name}</span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {s.subjects.map((sub) => (
                              <span
                                key={sub.subject}
                                className="rounded bg-cream-card px-1.5 py-0.5 text-[9.5px] tabular-nums text-espresso-muted dark:bg-white/5 dark:text-cream/50"
                              >
                                {sub.subject} <b className="text-espresso dark:text-cream">{sub.net}</b> ({sub.correct}·{sub.wrong}·{sub.blank})
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-espresso-muted dark:text-cream/50">
                          {s.rank ? (
                            <span className={cn("inline-flex items-center gap-1", s.rank <= 3 && "font-bold text-amber-600 dark:text-amber-400")}>
                              {s.rank <= 3 && <Trophy className="h-3 w-3" />}
                              {s.rank}/{s.participantCount}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right">
                          <span className="font-bold tabular-nums text-espresso dark:text-cream">{s.totalNet}</span>
                          {delta !== null && (
                            <span className={cn("ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums", toneClass)}>
                              <Icon className="h-2.5 w-2.5" />
                              {delta > 0 ? "+" : ""}
                              {delta}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-hairline p-3 dark:border-white/10">
              <p className="mb-2 text-[11px] font-semibold text-espresso dark:text-cream">Ders Ortalamaları</p>
              <div className="space-y-1.5">
                {data.subjectAverages.map((s) => (
                  <div key={s.subject} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[11px] text-espresso-muted dark:text-cream/50">{s.subject}</span>
                    <span className="shrink-0 text-[11px] font-bold tabular-nums text-espresso dark:text-cream">{s.averageNet}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-hairline p-3 dark:border-white/10">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-espresso dark:text-cream">
                <Target className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Zayıf Kazanımları
              </p>
              {data.weakSubtopics.length === 0 ? (
                <p className="py-3 text-[10.5px] leading-relaxed text-espresso-muted dark:text-cream/40">
                  Kazanım eşlemesi yapılmamış — denemenin &quot;Kazanım&quot; adımında soruları konulara bağlarsan burada dolar.
                </p>
              ) : (
                <div className="space-y-2">
                  {data.weakSubtopics.map((w) => {
                    const bar = w.percent < 30 ? "bg-rose-500" : w.percent < 60 ? "bg-amber-500" : "bg-emerald-500";
                    return (
                      <div key={w.subtopicLabel}>
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate text-[10.5px] text-espresso dark:text-cream">{w.subtopicLabel}</span>
                          <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">%{w.percent}</span>
                        </div>
                        <div className="h-1 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                          <div className={cn("h-full rounded-full", bar)} style={{ width: `${w.percent}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
