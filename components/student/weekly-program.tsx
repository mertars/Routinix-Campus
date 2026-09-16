"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, CalendarCheck2, Check, FileDown, Loader2, PlayCircle, Scan, Target } from "lucide-react";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// ÖĞRENCİNİN HAFTALIK ÇALIŞMA PROGRAMI — yatay pano.
//
// ⚠️ NEDEN YENİDEN YAZILDI (Mert, 2026-09-15): "öğrencideki çalışma programı
// yatay güzel bir sunum da olsun ve kendi sayfasından da pdf alabilsin,
// programı inceleyebilsin... video röntgen testleri ordan giriş yapılabilsin".
// Eski görünüm günleri alt alta dizen düz bir listeydi; haftanın tamamını
// birden görmek mümkün değildi ve blok yalnızca METİNDİ — öğrenci videoyu
// oradan açamıyordu ("video izlenmiyor").
//
// Yatay pano: 7 gün yan yana sütun, mobilde yatay kayar (dokunmatikte doğal),
// masaüstünde hepsi ekranda. Her blok TÜRÜNE göre eylem taşır ve tamamlanma
// durumu üstünde görünür.
// ----------------------------------------------------------------------------

export type ProgramEntryKind = "QUESTION" | "TOPIC_STUDY" | "VIDEO" | "XRAY_TEST";

export type StudentProgramEntry = {
  id: string;
  day: string;
  time: string;
  subject: string;
  topic: string;
  questionTarget: number;
  kind?: ProgramEntryKind;
  note?: string | null;
  video?: { id: string; title: string; youtubeId: string | null } | null;
  videoAssignmentId?: string | null;
  watchedAt?: string | null;
  xrayAssignment?: { id: string; status: string; completedAt: string | null } | null;
  done?: boolean | null;
  manualDone?: boolean;
  /** En ileri izlenen saniye ve yüzdesi (bkz. VideoAssignment.watchedSeconds). */
  watchedSeconds?: number | null;
  videoDurationSeconds?: number | null;
  watchedPercent?: number | null;
};

/** 153 → "2dk 33sn" */
function formatWatched(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

export type StudentProgram = {
  id: string;
  weekLabel: string;
  createdAt: string;
  entries: StudentProgramEntry[];
};

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

const KIND_META: Record<ProgramEntryKind, { label: string; icon: typeof Target; dot: string; chip: string }> = {
  QUESTION: { label: "Soru", icon: Target, dot: "bg-brand-600", chip: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300" },
  TOPIC_STUDY: { label: "Konu", icon: BookOpen, dot: "bg-violet-600", chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  VIDEO: { label: "Video", icon: PlayCircle, dot: "bg-rose-600", chip: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  XRAY_TEST: { label: "Röntgen", icon: Scan, dot: "bg-sky-600", chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
};

/** Bugünün Türkçe gün adı — sütunu vurgulamak için. */
function todayName(): string {
  return ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"][new Date().getDay()];
}

export function StudentWeeklyProgram({
  program,
  studentId,
  onChanged,
}: {
  program: StudentProgram;
  studentId: string;
  /** Bir blok işaretlenince üst bileşen programı tazelesin. */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { showError } = useToast();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  // İyimser güncelleme: sunucu cevabı beklenmeden rozet değişir, hata
  // olursa geri alınır — tek tuşluk bir işlem için bekletmek gereksiz.
  const [localDone, setLocalDone] = useState<Record<string, boolean>>({});
  const today = todayName();

  /** Video/röntgen bloğunu aç — hedef hazır değilse uç hazırlar. */
  async function onOpen(entryId: string) {
    setBusyId(entryId);
    try {
      const res = await fetch(`/api/guidance-program/entries/${entryId}/open`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error ?? "Açılamadı.");
      router.push(data.url);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Açılamadı.");
      setBusyId(null);
    }
  }

  async function onToggle(entryId: string, next: boolean) {
    setBusyId(entryId);
    setLocalDone((p) => ({ ...p, [entryId]: next }));
    try {
      const res = await fetch(`/api/guidance-program/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "İşaretlenemedi.");
      onChanged?.();
    } catch (error) {
      setLocalDone((p) => ({ ...p, [entryId]: !next }));
      showError(error instanceof Error ? error.message : "İşaretlenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  const byDay = useMemo(
    () => DAYS.map((d) => ({ day: d, entries: program.entries.filter((e) => e.day === d) })),
    [program.entries]
  );

  const totals = useMemo(() => {
    const questions = program.entries.reduce((s, e) => s + ((e.kind ?? "QUESTION") === "VIDEO" || e.kind === "TOPIC_STUDY" ? 0 : e.questionTarget), 0);
    // Artık HER blok takip edilebilir (video/röntgen doğal sinyalle,
    // soru/konu öğrencinin işaretiyle).
    const done = program.entries.filter((e) => localDone[e.id] ?? e.done === true).length;
    return { blocks: program.entries.length, questions, done, trackable: program.entries.length };
  }, [program.entries, localDone]);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await fetchAndDownloadPdf(
        "/api/guidance-program/pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId,
            weekLabel: program.weekLabel,
            entries: program.entries.map((e) => ({
              day: e.day,
              time: e.time,
              subject: e.subject,
              topic: e.kind === "VIDEO" && e.video ? e.video.title : e.topic,
              questionTarget: e.questionTarget,
              kind: e.kind ?? "QUESTION",
              note: e.note ?? null,
            })),
          }),
        },
        `calisma-programi-${program.weekLabel}.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <CalendarCheck2 className="h-4 w-4 text-brand-600" /> {program.weekLabel}
          </h2>
          <p className="text-[11px] text-espresso-muted dark:text-cream/45">
            {totals.blocks} çalışma · {totals.questions > 0 ? `${totals.questions} soru hedefi · ` : ""}
            {totals.trackable > 0 ? `${totals.done}/${totals.trackable} tamamlandı` : "takip edilen görev yok"}
          </p>
        </div>
        <button
          onClick={downloadPdf}
          disabled={pdfBusy}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-hairline px-3 text-[12px] font-semibold text-espresso transition hover:bg-cream-card disabled:opacity-50 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} PDF indir
        </button>
      </div>

      {/* Yatay pano — mobilde kayar, masaüstünde tamamı görünür.
          ⚠️ overflow-x-auto KENDİ konteynerinde: sayfanın gövdesi asla
          yana kaymaz (CLAUDE.md mobil kuralı). */}
      <div className="-mx-1 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        <div className="flex min-w-max gap-2">
          {byDay.map(({ day, entries }) => {
            const isToday = day === today;
            return (
              <section
                key={day}
                className={cn(
                  "w-[13.5rem] shrink-0 rounded-2xl border p-2",
                  isToday
                    ? "border-brand-500/50 bg-brand-500/[0.06]"
                    : "border-hairline bg-cream-card/60 dark:border-white/10 dark:bg-white/[0.03]"
                )}
              >
                <p
                  className={cn(
                    "mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wide",
                    isToday ? "text-brand-700 dark:text-brand-300" : "text-espresso-muted dark:text-cream/40"
                  )}
                >
                  {day}
                  {isToday && <span className="rounded-full bg-brand-600 px-1.5 text-[9px] text-white">bugün</span>}
                  {entries.length > 0 && (
                    <span className="ml-auto rounded-full bg-white px-1.5 text-[9.5px] tabular-nums dark:bg-white/10">
                      {entries.length}
                    </span>
                  )}
                </p>

                {entries.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[10.5px] text-espresso-muted/70 dark:text-cream/25">boş</p>
                ) : (
                  <div className="space-y-1.5">
                    {entries.map((entry, i) => {
                      const kind = entry.kind ?? "QUESTION";
                      const meta = KIND_META[kind];
                      const Icon = meta.icon;
                      // Yerel iyimser durum varsa o kazanır.
                      const done = localDone[entry.id] ?? entry.done === true;
                      return (
                        <motion.div
                          key={entry.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(i, 5) * 0.03 }}
                          className={cn(
                            "rounded-xl border bg-white p-2 dark:bg-midnight-card/70",
                            done ? "border-green-500/40" : "border-hairline dark:border-white/10"
                          )}
                        >
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                            <span className="truncate text-[10px] font-semibold tabular-nums text-espresso-muted dark:text-cream/45">
                              {entry.time}
                            </span>
                            {done && (
                              <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded-full bg-green-100 px-1.5 text-[9px] font-bold text-green-700 dark:bg-green-500/15 dark:text-green-400">
                                <Check className="h-2.5 w-2.5" /> bitti
                              </span>
                            )}
                          </div>

                          <p className="truncate text-[12px] font-semibold text-espresso dark:text-cream">{entry.subject}</p>
                          <p className="line-clamp-2 text-[11px] leading-snug text-espresso-muted dark:text-cream/50">
                            {kind === "VIDEO" && entry.video ? entry.video.title : entry.topic}
                          </p>
                          {/* ⚠️ "Ne kadar izlendi" — sadece izlendi/izlenmedi
                              değil (Mert). Süre bilinmiyorsa yalnızca dakika
                              gösterilir, uydurma bir yüzde YAZILMAZ. */}
                          {kind === "VIDEO" && (entry.watchedSeconds ?? 0) > 0 && (
                            <p className="mt-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-300">
                              {formatWatched(entry.watchedSeconds!)} izlendi
                              {entry.watchedPercent !== null && entry.watchedPercent !== undefined ? ` · %${entry.watchedPercent}` : ""}
                            </p>
                          )}
                          {entry.note && (
                            <p className="mt-0.5 line-clamp-2 text-[10px] italic leading-snug text-espresso-muted/80 dark:text-cream/35">
                              {entry.note}
                            </p>
                          )}

                          {/* ⚠️ Blok artık METİN DEĞİL, GİRİŞ NOKTASI: video
                              oynatıcıya, röntgen testi de teste götürür.
                              "Video izle" deyip nereye gideceğini söylememek
                              bildirim gönderip gidecek yer vermemekle aynı hata. */}
                          <div className="mt-1.5">
                            {kind === "VIDEO" || kind === "XRAY_TEST" ? (
                              /* ⚠️ Doğrudan LİNK DEĞİL, uç üzerinden açılıyor
                                 (POST .../open). Sebebi canlı veride ölçüldü:
                                 bir VIDEO bloğunun videoId'si vardı ama
                                 VideoAssignment'ı YOKTU (program, atama üretme
                                 özelliğinden önce yazılmıştı) — öğrenci "İzle"ye
                                 basınca video sekmesi o videoyu listelemiyor ve
                                 HİÇBİR ŞEY açılmıyordu. Uç, hedefi açmadan önce
                                 atamayı GARANTİ EDER. Aynısı röntgen için de
                                 geçerli. */
                              <div className="flex gap-1">
                                <button
                                  onClick={() => onOpen(entry.id)}
                                  disabled={busyId === entry.id}
                                  className={cn(
                                    "flex min-h-[32px] flex-1 items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition hover:opacity-85 disabled:opacity-60",
                                    done ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : meta.chip
                                  )}
                                >
                                  {busyId === entry.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                                  {kind === "VIDEO"
                                    ? done
                                      ? "Tekrar izle"
                                      : "İzle"
                                    : done
                                      ? "Sonucu gör"
                                      : "Teste başla"}
                                </button>
                                {/* ⚠️ Elle işaretleme burada da DURMALI: röntgen
                                    konusunun soru havuzu boşsa test açılamıyor
                                    (uç bunu açıkça söylüyor) ve öğrencinin
                                    bloğu kapatacak başka yolu kalmazdı. Video
                                    başka bir yerden izlenmiş de olabilir. */}
                                {!done && (
                                  <button
                                    onClick={() => onToggle(entry.id, true)}
                                    disabled={busyId === entry.id}
                                    title="Yaptım olarak işaretle"
                                    aria-label="Yaptım olarak işaretle"
                                    className="flex min-h-[32px] w-8 shrink-0 items-center justify-center rounded-lg border border-hairline text-espresso-muted transition hover:bg-cream-card hover:text-green-700 disabled:opacity-60 dark:border-white/10 dark:text-cream/40 dark:hover:bg-white/5"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              /* ⚠️ SORU / KONU (ve ataması olmayan röntgen)
                                 blokları artık TIKLANABİLİR. Eskiden burada
                                 "40 soru" yazan ölü bir <span> vardı ve
                                 sistemdeki blokların %96'sı bu türdeydi —
                                 "tuşlar hiçbir tepki vermiyor" şikâyetinin
                                 tam sebebi buydu. Video/röntgende doğal bir
                                 tamamlanma sinyali var; soru ve konu
                                 çalışmada yok, o yüzden öğrenci kendisi
                                 işaretler. */
                              <button
                                onClick={() => onToggle(entry.id, !done)}
                                disabled={busyId === entry.id}
                                className={cn(
                                  "flex min-h-[32px] w-full items-center justify-center gap-1 rounded-lg text-[11px] font-semibold transition active:scale-[0.98] disabled:opacity-60",
                                  done ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : meta.chip
                                )}
                              >
                                {busyId === entry.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : done ? (
                                  <Check className="h-3 w-3" />
                                ) : (
                                  <Icon className="h-3 w-3" />
                                )}
                                {done ? "Yapıldı" : kind === "QUESTION" ? `${entry.questionTarget} soru · yaptım` : `${meta.label} · yaptım`}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
