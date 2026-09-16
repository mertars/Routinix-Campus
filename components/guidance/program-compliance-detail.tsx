"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { BookOpen, CalendarPlus, Check, Info, Loader2, PlayCircle, Scan, Target, X } from "lucide-react";
import { useCachedFetch } from "@/lib/client/cached-fetch";
import { cn } from "@/lib/utils";

// PROGRAM UYUM DÖKÜMÜ — "İncele" ekranı.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16: "program takibinde alttaki ekran kafa
// karıştırıcı, incele butonu olsun, direkt o ekranda ne anlatmak
// istiyorsan onun tabloları olsun"). Liste ekranı tek bir yüzde
// gösteriyordu; "neden %0" sorusunun cevabı — hangi gün, hangi blok,
// hangi ders yapılmadı — hiçbir yerde yoktu. Burada üç tablo var:
// ders bazlı, blok türü bazlı ve hafta hafta blok dökümü.

type Entry = {
  id: string;
  day: string;
  time: string | null;
  subject: string;
  topic: string | null;
  kind: string;
  questionTarget: number | null;
  note: string | null;
  videoTitle: string | null;
  watchedPercent: number | null;
  xrayStatus: string | null;
  done: boolean;
  completedAt: string | null;
};

type Detail = {
  student: { id: string; name: string; branchName: string | null };
  weeks: number;
  summary: { total: number; done: number; percent: number | null; programCount: number };
  bySubject: { subject: string; total: number; done: number; percent: number }[];
  byKind: { kind: string; total: number; done: number }[];
  programs: { id: string; weekLabel: string; createdAt: string; entries: Entry[] }[];
};

const KIND_META: Record<string, { label: string; icon: typeof Target }> = {
  QUESTION: { label: "Soru çözümü", icon: Target },
  TOPIC_STUDY: { label: "Konu çalışması", icon: BookOpen },
  VIDEO: { label: "Video ders", icon: PlayCircle },
  XRAY_TEST: { label: "Röntgen testi", icon: Scan },
};

const DAY_ORDER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
      <div
        className={cn(
          "h-full rounded-full",
          percent >= 70 ? "bg-emerald-500" : percent >= 40 ? "bg-amber-500" : "bg-rose-500"
        )}
        style={{ width: `${Math.max(2, percent)}%` }}
      />
    </div>
  );
}

export function ProgramComplianceDetail({
  studentId,
  weeks,
  onClose,
  onPlanMeeting,
}: {
  studentId: string;
  weeks: number;
  onClose: () => void;
  onPlanMeeting: (studentId: string) => void;
}) {
  const { data, loading, failed } = useCachedFetch<Detail>(
    `/api/guidance/program-compliance/${studentId}?weeks=${weeks}`,
    { ttlMs: 30_000 }
  );
  const [openProgram, setOpenProgram] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // İlk program açık başlasın — tek programı olan öğrencide fazladan
  // bir tıklama istememek için.
  useEffect(() => {
    if (data && openProgram === null && data.programs[0]) setOpenProgram(data.programs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="fixed inset-0 z-[130] flex flex-col bg-cream dark:bg-midnight">
        <div className="shrink-0 border-b border-hairline bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-midnight-card/80">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-4 py-3 md:px-8">
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-600">Program Uyumu</p>
              <h2 className="truncate text-lg font-bold leading-tight text-espresso dark:text-cream">
                {data?.student.name ?? "Yükleniyor…"}
              </h2>
              {data && (
                <p className="mt-0.5 text-[11.5px] text-espresso-muted dark:text-cream/45">
                  {data.student.branchName ?? "Şubesiz"} · son {data.weeks} hafta · {data.summary.programCount} program
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {data && (
                <button
                  onClick={() => {
                    onPlanMeeting(data.student.id);
                    onClose();
                  }}
                  className="hidden min-h-[40px] items-center gap-1.5 rounded-xl bg-espresso px-3.5 text-[12px] font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500 sm:flex"
                >
                  <CalendarPlus className="h-3.5 w-3.5" /> Görüşme Planla
                </button>
              )}
              <button
                onClick={onClose}
                aria-label="Kapat"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-hairline text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-3.5 px-4 py-5 md:px-8">
            {loading && (
              <div className="flex justify-center py-24">
                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
              </div>
            )}
            {failed && (
              <p className="py-24 text-center text-sm text-espresso-muted dark:text-cream/40">Döküm yüklenemedi.</p>
            )}

            {data && (
              <>
                {/* BU EKRAN NE ANLATIYOR */}
                <div className="flex gap-2.5 rounded-2xl border border-brand-500/25 bg-brand-50/60 p-3.5 dark:border-brand-500/20 dark:bg-brand-600/10">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <p className="text-[11.5px] leading-relaxed text-espresso dark:text-cream/70">
                    Bu ekran <strong>yazdığınız programın ne kadarının yapıldığını</strong> gösterir. Aşağıdaki
                    tablolar aynı veriyi üç soruya göre böler: <strong>hangi derste</strong> takılıyor,{" "}
                    <strong>ne tür işi</strong> (soru / konu / video / röntgen) atlıyor ve{" "}
                    <strong>hangi hafta hangi bloğu</strong> yapmadı. Görüşmeye bu üç cevapla girip &quot;Pazartesi
                    Matematik bloğunu üç haftadır yapmıyorsun&quot; diyebilirsiniz.
                  </p>
                </div>

                {/* ÖZET */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-midnight-card/60">
                    <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                      {data.summary.percent !== null ? `%${data.summary.percent}` : "—"}
                    </p>
                    <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Uyum oranı</p>
                  </div>
                  <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-midnight-card/60">
                    <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                      {data.summary.done}/{data.summary.total}
                    </p>
                    <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Yapılan blok</p>
                  </div>
                  <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-midnight-card/60">
                    <p className="text-2xl font-bold leading-none tabular-nums text-espresso dark:text-cream">
                      {data.summary.programCount}
                    </p>
                    <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/45">Verilen program</p>
                  </div>
                </div>

                {/* TABLO 1 — DERS BAZLI */}
                <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/60">
                  <h3 className="text-[13px] font-bold text-espresso dark:text-cream">Hangi derste takılıyor</h3>
                  <p className="mb-2.5 mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                    En düşük uyum en üstte — programın o derse ait bloklarının kaçı yapıldı.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[380px] text-left">
                      <thead>
                        <tr className="border-b border-hairline text-[10.5px] uppercase tracking-wide text-espresso-muted dark:border-white/10 dark:text-cream/40">
                          <th className="pb-1.5 font-semibold">Ders</th>
                          <th className="pb-1.5 text-right font-semibold">Yapılan</th>
                          <th className="pb-1.5 text-right font-semibold">Toplam</th>
                          <th className="w-[38%] pb-1.5 pl-3 font-semibold">Uyum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.bySubject.map((r) => (
                          <tr key={r.subject} className="border-b border-hairline/60 last:border-0 dark:border-white/5">
                            <td className="py-2 text-[12.5px] font-medium text-espresso dark:text-cream">{r.subject}</td>
                            <td className="py-2 text-right text-[12.5px] font-bold tabular-nums text-espresso dark:text-cream">
                              {r.done}
                            </td>
                            <td className="py-2 text-right text-[12px] tabular-nums text-espresso-muted dark:text-cream/45">
                              {r.total}
                            </td>
                            <td className="py-2 pl-3">
                              <div className="flex items-center gap-2">
                                <Bar percent={r.percent} />
                                <span className="w-9 shrink-0 text-right text-[11px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">
                                  %{r.percent}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TABLO 2 — BLOK TÜRÜ */}
                <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/60">
                  <h3 className="text-[13px] font-bold text-espresso dark:text-cream">Ne tür işi atlıyor</h3>
                  <p className="mb-2.5 mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                    Video izliyor ama soru çözmüyor mu? Bu ayrım tek bir yüzdeyle görünmez.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.byKind.map((k) => {
                      const meta = KIND_META[k.kind] ?? { label: k.kind, icon: Target };
                      const Icon = meta.icon;
                      const percent = k.total > 0 ? Math.round((k.done / k.total) * 100) : 0;
                      return (
                        <div key={k.kind} className="rounded-xl bg-cream-card/70 px-3 py-2.5 dark:bg-white/[0.04]">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[12px] font-medium text-espresso dark:text-cream">
                              <Icon className="h-3.5 w-3.5 text-brand-600" /> {meta.label}
                            </span>
                            <span className="text-[11.5px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">
                              {k.done}/{k.total}
                            </span>
                          </div>
                          <Bar percent={percent} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* TABLO 3 — HAFTA HAFTA BLOK DÖKÜMÜ */}
                <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/60">
                  <h3 className="text-[13px] font-bold text-espresso dark:text-cream">Hangi hafta hangi blok</h3>
                  <p className="mb-2.5 mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                    Programın satır satır dökümü — yeşil tik yapılanı, boş kutu yapılmayanı gösterir.
                  </p>
                  <div className="space-y-2">
                    {data.programs.map((p) => {
                      const open = openProgram === p.id;
                      const done = p.entries.filter((e) => e.done).length;
                      return (
                        <div key={p.id} className="overflow-hidden rounded-xl border border-hairline dark:border-white/10">
                          <button
                            onClick={() => setOpenProgram(open ? null : p.id)}
                            className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left transition hover:bg-cream-card/60 dark:hover:bg-white/[0.04]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] font-semibold text-espresso dark:text-cream">
                                {p.weekLabel}
                              </span>
                              <span className="block text-[10.5px] text-espresso-muted dark:text-cream/40">
                                {shortDate(p.createdAt)} tarihinde verildi
                              </span>
                            </span>
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums",
                                done === p.entries.length
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : done === 0
                                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                              )}
                            >
                              {done}/{p.entries.length}
                            </span>
                          </button>

                          {open && (
                            <div className="border-t border-hairline px-3 py-2 dark:border-white/10">
                              {p.entries.length === 0 ? (
                                <p className="py-3 text-center text-[11.5px] text-espresso-muted dark:text-cream/40">
                                  Bu programda blok yok.
                                </p>
                              ) : (
                                [...p.entries]
                                  .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
                                  .map((e) => {
                                    const meta = KIND_META[e.kind] ?? { label: e.kind, icon: Target };
                                    return (
                                      <div
                                        key={e.id}
                                        className="flex items-start gap-2.5 border-b border-hairline/60 py-2 last:border-0 dark:border-white/5"
                                      >
                                        <span
                                          className={cn(
                                            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
                                            e.done
                                              ? "bg-emerald-500 text-white"
                                              : "border border-espresso/20 dark:border-white/20"
                                          )}
                                        >
                                          {e.done && <Check className="h-3 w-3" />}
                                        </span>
                                        <span className="w-[68px] shrink-0 text-[11px] font-medium text-espresso-muted dark:text-cream/45">
                                          {e.day}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-[12px] font-medium text-espresso dark:text-cream">
                                            {e.subject}
                                            {e.topic ? ` · ${e.topic}` : ""}
                                          </span>
                                          <span className="block truncate text-[10.5px] text-espresso-muted dark:text-cream/40">
                                            {[
                                              meta.label,
                                              e.time || null,
                                              e.questionTarget ? `${e.questionTarget} soru` : null,
                                              e.videoTitle,
                                              e.watchedPercent !== null ? `%${e.watchedPercent} izlendi` : null,
                                              e.xrayStatus === "COMPLETED"
                                                ? "test çözüldü"
                                                : e.xrayStatus
                                                  ? "test çözülmedi"
                                                  : null,
                                            ]
                                              .filter(Boolean)
                                              .join(" · ")}
                                          </span>
                                        </span>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
