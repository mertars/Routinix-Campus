"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  Eye,
  EyeOff,
  Info,
  Loader2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// GÖRÜŞME ETKİSİ — "konuştuk, sonra ne oldu?"
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): rehberliğin yaptığı iş sistemde hiç
// ölçülmüyordu. Görüşme kaydediliyordu ama işe yarayıp yaramadığı
// görünmüyordu. Üç sinyal de zaten kayıtlı: devam, ödev, deneme neti.
//
// ⚠️ DÜRÜSTLÜK KURALI: bu ekran NEDENSELLİK iddia ETMEZ. Aynı dönemde
// tatil, sınav haftası ya da başka bir müdahale de olmuş olabilir. Bu
// yüzden başlıklar "etkisi" değil "görüşme sonrası değişim" der, ölçüm
// penceresi henüz dolmadıysa açıkça söylenir ve veri yoksa sayı
// UYDURULMAZ — "yeterli kayıt yok" yazar.
// ----------------------------------------------------------------------------

type Window = {
  attendanceRate: number | null;
  attendanceCount: number;
  homeworkRate: number | null;
  homeworkCount: number;
  avgNet: number | null;
  examCount: number;
  examNames: string[];
};

type MeetingRow = {
  id: string;
  scheduledAt: string;
  topic: string;
  category: string;
  status: string;
  attendee: string;
  outcomeNote: string | null;
  counselorName: string | null;
  isFuture: boolean;
  windowComplete: boolean;
  before: Window;
  after: Window;
};

type SharedNote = {
  id: string;
  note: string;
  category: string;
  authorName: string;
  createdAt: string;
  parentReadAt: string | null;
};

type Impact = {
  student: { id: string; name: string; branchName: string | null };
  windowDays: number;
  meetings: MeetingRow[];
  sharedNotes: SharedNote[];
};

const MEETING_STATUS: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Planlandı", className: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300" },
  DONE: { label: "Yapıldı", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  NO_SHOW: { label: "Gelmedi", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  CANCELLED: { label: "İptal", className: "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/45" },
};
const ATTENDEE_LABEL: Record<string, string> = { STUDENT: "Öğrenci", PARENT: "Veli", BOTH: "Öğrenci + Veli" };

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}
function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Önce → sonra karşılaştırması; veri yoksa sayı uydurmaz. */
function DeltaRow({
  icon: Icon,
  label,
  before,
  after,
  beforeCount,
  afterCount,
  unit,
  higherIsBetter = true,
  footnote,
}: {
  icon: typeof TrendingUp;
  label: string;
  before: number | null;
  after: number | null;
  beforeCount: number;
  afterCount: number;
  unit: "percent" | "net";
  higherIsBetter?: boolean;
  /** Sayının neyden hesaplandığı — ör. karşılaştırılan denemelerin adları. */
  footnote?: string | null;
}) {
  const fmt = (v: number | null) => (v === null ? "—" : unit === "percent" ? `%${v}` : String(v));
  const delta = before !== null && after !== null ? Math.round((after - before) * 10) / 10 : null;
  const good = delta === null ? null : higherIsBetter ? delta > 0 : delta < 0;

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-cream-card/70 px-3 py-2 dark:bg-white/[0.04]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-espresso-muted dark:bg-white/[0.06] dark:text-cream/45">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold text-espresso-muted dark:text-cream/45">{label}</span>
        <span className="block truncate text-[10px] text-espresso-muted/70 dark:text-cream/30">
          {beforeCount === 0 && afterCount === 0
            ? "iki pencerede de kayıt yok"
            : (footnote ?? `${beforeCount} → ${afterCount} kayıt`)}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[13px] font-bold tabular-nums text-espresso-muted dark:text-cream/45">{fmt(before)}</span>
        <ArrowRight className="h-3 w-3 text-espresso-muted/50 dark:text-cream/25" />
        <span className="text-[15px] font-bold tabular-nums text-espresso dark:text-cream">{fmt(after)}</span>
        {delta !== null && delta !== 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums",
              good
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

export function MeetingImpactPanel({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const { showError } = useToast();
  const [data, setData] = useState<Impact | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/guidance/students/${studentId}/meeting-impact`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {
        setFailed(true);
        showError("Görüşme etkisi yüklenemedi.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const unreadShared = (data?.sharedNotes ?? []).filter((n) => !n.parentReadAt);

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="fixed inset-0 z-[130] flex flex-col bg-cream dark:bg-midnight">
        <div className="shrink-0 border-b border-hairline bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-midnight-card/80">
          <div className="mx-auto flex max-w-4xl items-start justify-between gap-3 px-4 py-3 md:px-8">
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-600">Görüşme Etkisi</p>
              <h2 className="truncate text-lg font-bold leading-tight text-espresso dark:text-cream">
                {data?.student.name ?? "Yükleniyor…"}
              </h2>
              {data && (
                <p className="mt-0.5 text-[11.5px] text-espresso-muted dark:text-cream/45">
                  {data.student.branchName ?? "Şubesiz"} · her görüşmenin öncesi/sonrası {data.windowDays} gün
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-hairline text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 md:px-8">
            {!data && !failed && (
              <div className="flex justify-center py-24">
                <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
              </div>
            )}
            {failed && (
              <p className="py-24 text-center text-sm text-espresso-muted dark:text-cream/40">
                Görüşme etkisi yüklenemedi.
              </p>
            )}

            {data && (
              <>
                {/* YÖNTEM — iddia edilmeyen şeyi açıkça söyle */}
                <div className="flex gap-2.5 rounded-2xl border border-brand-500/25 bg-brand-50/60 p-3.5 dark:border-brand-500/20 dark:bg-brand-600/10">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <p className="text-[11.5px] leading-relaxed text-espresso dark:text-cream/70">
                    Her görüşmenin <strong>öncesindeki ve sonrasındaki {data.windowDays} gün</strong> karşılaştırılır:
                    devam oranı, ödev teslim oranı ve deneme net ortalaması. Bu bir neden-sonuç kanıtı değildir — aynı
                    dönemde tatil, sınav haftası ya da başka bir müdahale de olmuş olabilir. Yeterli kayıt yoksa sayı
                    üretilmez, &quot;kayıt yok&quot; yazar.
                  </p>
                </div>

                {/* VELİYLE PAYLAŞILAN NOTLAR */}
                <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/60">
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[13px] font-bold text-espresso dark:text-cream">Veliyle paylaşılan notlar</h3>
                    {data.sharedNotes.length > 0 && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                          unreadShared.length > 0
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        )}
                      >
                        {unreadShared.length > 0 ? `${unreadShared.length} not açılmadı` : "hepsi okundu"}
                      </span>
                    )}
                  </div>
                  <p className="mb-2.5 text-[11px] text-espresso-muted dark:text-cream/40">
                    Yalnızca &quot;Veliyle paylaş&quot; seviyesindeki notlar veliye ulaşır. Veli kendi panelinde
                    rehberlik notlarını açtığında burada okundu olarak işaretlenir.
                  </p>
                  {data.sharedNotes.length === 0 ? (
                    <p className="py-5 text-center text-[12px] text-espresso-muted dark:text-cream/40">
                      Bu öğrenci için veliyle paylaşılmış not yok.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {data.sharedNotes.map((n) => {
                        const waiting = !n.parentReadAt ? daysSince(n.createdAt) : 0;
                        const stale = waiting >= 7;
                        return (
                          <div
                            key={n.id}
                            className={cn(
                              "flex items-start gap-2.5 rounded-xl px-3 py-2.5",
                              n.parentReadAt
                                ? "bg-cream-card/70 dark:bg-white/[0.04]"
                                : stale
                                  ? "bg-amber-50 dark:bg-amber-500/10"
                                  : "bg-cream-card/70 dark:bg-white/[0.04]"
                            )}
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                                n.parentReadAt
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                              )}
                            >
                              {n.parentReadAt ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 text-[12px] leading-snug text-espresso dark:text-cream/80">
                                {n.note}
                              </p>
                              <p className="mt-0.5 text-[10.5px] text-espresso-muted dark:text-cream/40">
                                {whenLabel(n.createdAt)} · {n.authorName} ·{" "}
                                {n.parentReadAt ? (
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    veli {whenLabel(n.parentReadAt)} tarihinde okudu
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      stale ? "text-amber-700 dark:text-amber-300" : "text-espresso-muted dark:text-cream/40"
                                    )}
                                  >
                                    {waiting === 0 ? "henüz açılmadı" : `${waiting} gündür açılmadı`}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* GÖRÜŞMELER */}
                {data.meetings.length === 0 ? (
                  <div className="rounded-2xl border border-hairline bg-white px-4 py-10 text-center dark:border-white/10 dark:bg-midnight-card/60">
                    <p className="text-sm font-medium text-espresso dark:text-cream">Henüz görüşme kaydı yok</p>
                    <p className="mt-1 text-[11.5px] text-espresso-muted dark:text-cream/40">
                      İlk görüşme planlandıktan sonra bu ekran öncesi/sonrası değişimi göstermeye başlar.
                    </p>
                  </div>
                ) : (
                  data.meetings.map((m, i) => {
                    const st = MEETING_STATUS[m.status] ?? { label: m.status, className: "bg-cream-card text-espresso-muted" };
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i, 6) * 0.03 }}
                        className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/60"
                      >
                        <div className="mb-2.5 flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5 text-brand-600" />
                              <span className="text-[13px] font-semibold text-espresso dark:text-cream">{m.topic}</span>
                              <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", st.className)}>
                                {st.label}
                              </span>
                              {m.attendee !== "STUDENT" && (
                                <span className="flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                  <Users className="h-2.5 w-2.5" /> {ATTENDEE_LABEL[m.attendee] ?? m.attendee}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                              {whenLabel(m.scheduledAt)}
                              {m.counselorName ? ` · ${m.counselorName}` : ""}
                            </p>
                          </div>
                          {!m.windowComplete && (
                            <span className="shrink-0 rounded-full bg-cream-card px-2 py-0.5 text-[10px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/45">
                              {m.isFuture ? "henüz yapılmadı" : `${data.windowDays} günlük pencere dolmadı`}
                            </span>
                          )}
                        </div>

                        {m.isFuture ? (
                          <p className="rounded-xl bg-cream-card/70 px-3 py-3 text-center text-[11.5px] text-espresso-muted dark:bg-white/[0.04] dark:text-cream/40">
                            Bu görüşme henüz yapılmadı — ölçülecek bir &quot;sonrası&quot; yok.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            <DeltaRow
                              icon={CheckCheck}
                              label="Devam oranı"
                              before={m.before.attendanceRate}
                              after={m.after.attendanceRate}
                              beforeCount={m.before.attendanceCount}
                              afterCount={m.after.attendanceCount}
                              unit="percent"
                            />
                            <DeltaRow
                              icon={ClipboardList}
                              label="Ödev teslim oranı"
                              before={m.before.homeworkRate}
                              after={m.after.homeworkRate}
                              beforeCount={m.before.homeworkCount}
                              afterCount={m.after.homeworkCount}
                              unit="percent"
                            />
                            <DeltaRow
                              icon={TrendingUp}
                              label="Deneme net ortalaması"
                              before={m.before.avgNet}
                              after={m.after.avgNet}
                              beforeCount={m.before.examCount}
                              afterCount={m.after.examCount}
                              unit="net"
                              footnote={
                                m.before.examNames.length + m.after.examNames.length > 0
                                  ? `${m.before.examNames.join(", ") || "yok"} → ${m.after.examNames.join(", ") || "yok"}`
                                  : null
                              }
                            />
                          </div>
                        )}

                        {m.outcomeNote && (
                          <p className="mt-2.5 whitespace-pre-wrap border-t border-hairline pt-2.5 text-[11.5px] leading-snug text-espresso-muted dark:border-white/10 dark:text-cream/50">
                            {m.outcomeNote}
                          </p>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>,
    document.body
  );
}
