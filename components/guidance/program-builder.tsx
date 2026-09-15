"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookMarked,
  CalendarRange,
  Check,
  Copy,
  FileDown,
  Loader2,
  Plus,
  Search,
  Send,
  Target,
  Trash2,
  TrendingDown,
  X,
} from "lucide-react";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// ÇALIŞMA PROGRAMI OLUŞTURUCU (rehberlik) — veriyle yazılan haftalık program.
//
// ⚠️ NEDEN YENİDEN YAZILDI (Mert, 2026-09-15): "program yazmada çok
// profesyonel bir iş bekliyorum, ekrana girdiğinde Öğrenci 360 verileri, şık
// plan ekle butonları, istediği kadar ekleme". Yönetici panelindeki eski
// ekran çalışıyordu ama KÖR yazıyordu: rehber öğretmen öğrencinin neyde
// zayıf olduğunu göremeden "Pazartesi Matematik" yazıyordu.
//
// Buradaki asıl fikir SOL SÜTUN: öğrencinin ders bazlı netleri ve EN ZAYIF
// KAZANIMLARI ekranda dururken program yazılır ve her kazanımın yanındaki
// "+" o kazanımı doğrudan haftanın bir gününe blok olarak atar. Program
// artık öğrencinin gerçek eksiğinden türer.
//
// Kaydedilen yapı ESKİSİYLE AYNI ({day,time,subject,topic,questionTarget}) —
// öğrencinin panelindeki görünüm ve PDF şablonu değişmeden çalışmaya devam
// eder (bkz. components/student/tabs/guidance.tsx, components/pdf/).
// ----------------------------------------------------------------------------

const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
type Day = (typeof DAYS)[number];

const TIME_PRESETS = ["08:00 - 09:00", "10:00 - 11:00", "14:00 - 15:00", "16:00 - 17:00", "17:00 - 18:00", "19:00 - 20:00", "20:00 - 21:00"];

type Entry = { key: string; day: Day; time: string; subject: string; topic: string; questionTarget: number };
type StudentOption = { id: string; name: string; branchName: string | null };
type Context = {
  student: { id: string; name: string; branchName: string | null; grade: number | null; track: string | null };
  subjects: {
    subject: string;
    avgNet: number;
    lastNet: number | null;
    examCount: number;
    absentCount: number;
    isAggregate: boolean;
    coversSubjects: string[];
  }[];
  weakTopics: { subject: string; subtopicId: string; name: string; score: number }[];
  subjectOptions: string[];
};
type SavedProgram = {
  id: string;
  weekLabel: string;
  createdAt: string;
  entries: { day: string; time: string; subject: string; topic: string; questionTarget: number }[];
};

let keySeq = 0;
function newKey(): string {
  keySeq += 1;
  return `e${keySeq}`;
}

function defaultWeekLabel(): string {
  const d = new Date();
  return `${d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} haftası`;
}

/** Kazanım hakimiyetine göre renk — %40 altı kırmızı, %70 altı kehribar. */
function scoreTone(score: number): string {
  if (score < 40) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
  if (score < 70) return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
  return "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400";
}

function StudentPicker({ onPick }: { onPick: (s: StudentOption) => void }) {
  const { showError } = useToast();
  const [students, setStudents] = useState<StudentOption[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/guidance/students")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setStudents(
          (d.students ?? []).map((s: { id: string; name?: string; branchName?: string | null }) => ({
            id: s.id,
            name: s.name ?? "",
            branchName: s.branchName ?? null,
          }))
        )
      )
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
  }, [showError]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    const list = students ?? [];
    if (!q) return list.slice(0, 50);
    return list.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q)).slice(0, 50);
  }, [students, query]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-espresso-muted dark:text-cream/35" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Program yazılacak öğrenciyi arayın..."
          className="min-h-[48px] w-full rounded-2xl border border-hairline bg-white pl-10 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      </div>
      {students === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="max-h-[26rem] overflow-y-auto rounded-2xl border border-hairline dark:border-white/10">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => onPick(s)}
              className="flex min-h-[48px] w-full items-center justify-between gap-2 border-b border-hairline px-3.5 text-left last:border-0 hover:bg-cream-card dark:border-white/5 dark:hover:bg-white/5"
            >
              <span className="truncate text-sm text-espresso dark:text-cream">{s.name}</span>
              {s.branchName && <span className="shrink-0 text-[11px] text-espresso-muted dark:text-cream/40">{s.branchName}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-8 text-center text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>
          )}
        </div>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  subjectOptions,
  onChange,
  onRemove,
  onDuplicate,
}: {
  entry: Entry;
  subjectOptions: string[];
  onChange: (patch: Partial<Entry>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const field =
    "min-h-[36px] w-full rounded-lg border border-hairline bg-white px-2 text-[12.5px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="rounded-xl border border-hairline bg-white p-2 dark:border-white/10 dark:bg-midnight-card/60"
    >
      <div className="mb-1.5 grid grid-cols-2 gap-1.5">
        <select value={entry.time} onChange={(e) => onChange({ time: e.target.value })} className={field}>
          {[...new Set([entry.time, ...TIME_PRESETS])].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {/* ⚠️ Serbest metin DEĞİL, listeden seçim: ders adları tek kaynaktan
            gelir (lib/subjects.ts) — kademenin gerçek dersleri + öğrencinin
            ders programındakiler. Serbest metinken deneme kitapçığı adları
            ("Fen Bilimleri") plana sızıyordu. */}
        <select
          value={entry.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          className={cn(field, !entry.subject && "text-espresso-muted dark:text-cream/40")}
        >
          <option value="">Ders seçin</option>
          {subjectOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <input
        value={entry.topic}
        onChange={(e) => onChange({ topic: e.target.value })}
        placeholder="Konu / kazanım"
        className={cn(field, "mb-1.5")}
      />
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Target className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-espresso-muted dark:text-cream/35" />
          <input
            type="number"
            min={0}
            max={999}
            value={entry.questionTarget}
            onChange={(e) => onChange({ questionTarget: Math.max(0, Number(e.target.value) || 0) })}
            className={cn(field, "pl-7")}
          />
        </div>
        <button
          onClick={onDuplicate}
          title="Bu bloğu çoğalt"
          aria-label="Bu bloğu çoğalt"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:text-cream/40 dark:hover:bg-white/5"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          title="Bloğu sil"
          aria-label="Bloğu sil"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition hover:bg-rose-500/10 dark:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

export function GuidanceProgramBuilder() {
  const { showError, showSuccess } = useToast();
  const [student, setStudent] = useState<StudentOption | null>(null);
  const [ctx, setCtx] = useState<Context | null>(null);
  const [weekLabel, setWeekLabel] = useState(defaultWeekLabel);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [history, setHistory] = useState<SavedProgram[] | null>(null);
  // Kazanım "+" tuşu hangi güne atsın — rehber sırayı kendisi kurar.
  const [targetDay, setTargetDay] = useState<Day>("Pazartesi");

  const loadHistory = useCallback(
    (studentId: string) => {
      fetch(`/api/guidance-program?studentId=${encodeURIComponent(studentId)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => setHistory(d.programs ?? []))
        .catch(() => setHistory([]));
    },
    []
  );

  useEffect(() => {
    if (!student) return;
    setCtx(null);
    fetch(`/api/guidance/students/${student.id}/program-context`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setCtx)
      .catch(() => showError("Öğrenci verileri yüklenemedi."));
    loadHistory(student.id);
  }, [student, showError, loadHistory]);

  function addEntry(day: Day, preset?: Partial<Entry>) {
    setEntries((prev) => [
      ...prev,
      {
        key: newKey(),
        day,
        time: preset?.time ?? TIME_PRESETS[3],
        subject: preset?.subject ?? "",
        topic: preset?.topic ?? "",
        questionTarget: preset?.questionTarget ?? 20,
      },
    ]);
  }

  const totals = useMemo(
    () => ({
      blocks: entries.length,
      questions: entries.reduce((sum, e) => sum + e.questionTarget, 0),
      days: new Set(entries.map((e) => e.day)).size,
    }),
    [entries]
  );

  const incomplete = entries.filter((e) => !e.subject.trim() || !e.topic.trim()).length;

  async function save() {
    if (!student || entries.length === 0) return;
    if (incomplete > 0) {
      showError(`${incomplete} blokta ders veya konu boş — eksik program gönderilemez.`);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/guidance-program", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id,
          weekLabel: weekLabel.trim() || defaultWeekLabel(),
          entries: entries.map((e) => ({
            day: e.day,
            time: e.time,
            subject: e.subject.trim(),
            topic: e.topic.trim(),
            questionTarget: e.questionTarget,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Program kaydedilemedi.");
      showSuccess(`${totals.blocks} bloklu program ${student.name} adlı öğrencinin paneline gönderildi.`);
      setEntries([]);
      loadHistory(student.id);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Program kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf(label: string, rows: { day: string; time: string; subject: string; topic: string; questionTarget: number }[]) {
    if (!student || rows.length === 0) return;
    setPdfBusy(true);
    try {
      await fetchAndDownloadPdf(
        "/api/guidance-program/pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: student.id, weekLabel: label, entries: rows }),
        },
        `${student.name}-calisma-programi.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setPdfBusy(false);
    }
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-base font-bold text-espresso dark:text-cream">Çalışma Programı</h2>
          <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/45">
            Öğrencinin netleri ve en zayıf kazanımları ekranda dururken program yazarsınız.
          </p>
        </div>
        <StudentPicker onPick={setStudent} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* --- Üst şerit: kim, hangi hafta --- */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-white px-3.5 py-2.5 dark:border-white/10 dark:bg-midnight-card/50">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-espresso dark:text-cream">{student.name}</p>
          <p className="truncate text-[11px] text-espresso-muted dark:text-cream/45">
            {ctx?.student.branchName ?? student.branchName ?? "—"}
            {ctx?.student.track ? ` · ${ctx.student.track}` : ""}
          </p>
        </div>
        <input
          value={weekLabel}
          onChange={(e) => setWeekLabel(e.target.value)}
          placeholder="Hafta etiketi"
          className="min-h-[40px] w-44 rounded-xl border border-hairline bg-white px-3 text-[13px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <button
          onClick={() => {
            setStudent(null);
            setEntries([]);
            setCtx(null);
          }}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-hairline px-3 text-[12px] font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
        >
          <X className="h-3.5 w-3.5" /> Öğrenci değiştir
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[19rem_1fr]">
        {/* --- SOL: öğrenci röntgeni --- */}
        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          {!ctx ? (
            <div className="flex justify-center rounded-2xl border border-hairline bg-white py-10 dark:border-white/10 dark:bg-midnight-card/50">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  <TrendingDown className="h-3.5 w-3.5" /> Ders netleri (zayıftan güçlüye)
                </h3>
                {ctx.subjects.length === 0 ? (
                  <p className="py-2 text-[11.5px] text-espresso-muted dark:text-cream/40">Henüz deneme sonucu yok.</p>
                ) : (
                  <div className="space-y-1">
                    {ctx.subjects.map((s) => (
                      <div key={s.subject} className="rounded-lg bg-cream-card px-2.5 py-1.5 dark:bg-white/5">
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-[12.5px] text-espresso dark:text-cream">{s.subject}</span>
                          {s.absentCount > 0 && (
                            <span className="shrink-0 text-[10px] text-rose-600 dark:text-rose-300">{s.absentCount} devamsız</span>
                          )}
                          <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-espresso dark:text-cream">{s.avgNet}</span>
                        </div>
                        {/* ⚠️ Kitapçık bölümü — gerçek bir ders DEĞİL, plana
                            ders olarak alınmaz (bkz. lib/subjects.ts). Neti
                            bilgi olarak duruyor ama hangi dersleri kapsadığı
                            açıkça yazılıyor ki rehber plana doğru dersi yazsın. */}
                        {s.isAggregate && s.coversSubjects.length > 0 && (
                          <p className="mt-0.5 text-[10px] leading-snug text-espresso-muted dark:text-cream/40">
                            deneme bölümü · {s.coversSubjects.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
                <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  <Target className="h-3.5 w-3.5" /> En zayıf kazanımlar
                </h3>
                <p className="mb-2 text-[10.5px] leading-snug text-espresso-muted dark:text-cream/40">
                  &quot;+&quot; tuşu kazanımı <span className="font-semibold">{targetDay}</span> gününe blok olarak ekler.
                </p>
                <select
                  value={targetDay}
                  onChange={(e) => setTargetDay(e.target.value as Day)}
                  className="mb-2 min-h-[36px] w-full rounded-lg border border-hairline bg-white px-2 text-[12.5px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d} gününe ekle
                    </option>
                  ))}
                </select>
                {ctx.weakTopics.length === 0 ? (
                  <p className="py-2 text-[11.5px] text-espresso-muted dark:text-cream/40">
                    Kazanım değerlendirmesi yok — Röntgen testi çözülmemiş.
                  </p>
                ) : (
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {ctx.weakTopics.map((t) => (
                      <div key={t.subtopicId} className="flex items-center gap-1.5 rounded-lg bg-cream-card px-2 py-1.5 dark:bg-white/5">
                        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums", scoreTone(t.score))}>
                          %{t.score}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] text-espresso dark:text-cream">{t.name}</span>
                          <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">{t.subject}</span>
                        </span>
                        <button
                          onClick={() => addEntry(targetDay, { subject: t.subject, topic: t.name, questionTarget: 30 })}
                          title={`${targetDay} gününe ekle`}
                          aria-label={`${t.name} kazanımını ${targetDay} gününe ekle`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-espresso text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </aside>

        {/* --- SAĞ: haftalık program --- */}
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {DAYS.map((day) => {
              const dayEntries = entries.filter((e) => e.day === day);
              return (
                <section
                  key={day}
                  className="rounded-2xl border border-hairline bg-cream-muted/40 p-2 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <h3 className="flex items-center gap-1.5 text-[12px] font-bold text-espresso dark:text-cream">
                      {day}
                      {dayEntries.length > 0 && (
                        <span className="rounded-full bg-brand-600/15 px-1.5 text-[10px] font-bold tabular-nums text-brand-700 dark:text-brand-300">
                          {dayEntries.length}
                        </span>
                      )}
                    </h3>
                    <button
                      onClick={() => addEntry(day)}
                      aria-label={`${day} gününe blok ekle`}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-white hover:text-brand-600 dark:text-cream/40 dark:hover:bg-white/10"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    <AnimatePresence mode="popLayout">
                      {dayEntries.map((entry) => (
                        <EntryCard
                          key={entry.key}
                          entry={entry}
                          subjectOptions={ctx?.subjectOptions ?? []}
                          onChange={(patch) =>
                            setEntries((prev) => prev.map((e) => (e.key === entry.key ? { ...e, ...patch } : e)))
                          }
                          onRemove={() => setEntries((prev) => prev.filter((e) => e.key !== entry.key))}
                          onDuplicate={() => setEntries((prev) => [...prev, { ...entry, key: newKey() }])}
                        />
                      ))}
                    </AnimatePresence>
                    {dayEntries.length === 0 && (
                      <button
                        onClick={() => addEntry(day)}
                        className="w-full rounded-xl border border-dashed border-hairline py-3 text-[11px] text-espresso-muted transition hover:border-brand-500/50 hover:text-brand-600 dark:border-white/10 dark:text-cream/35"
                      >
                        + blok ekle
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          {/* --- Alt şerit: toplam + kaydet --- */}
          <div className="sticky bottom-0 flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-white/95 px-3.5 py-2.5 shadow-lg backdrop-blur dark:border-white/10 dark:bg-midnight-card/95">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-espresso-muted dark:text-cream/50">
              <CalendarRange className="h-3.5 w-3.5" />
              {totals.blocks} blok · {totals.days} gün · <span className="font-bold text-espresso dark:text-cream">{totals.questions} soru</span>
            </span>
            {incomplete > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                {incomplete} blok eksik
              </span>
            )}
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button
                onClick={() =>
                  downloadPdf(
                    weekLabel,
                    entries.map((e) => ({ day: e.day, time: e.time, subject: e.subject, topic: e.topic, questionTarget: e.questionTarget }))
                  )
                }
                disabled={pdfBusy || entries.length === 0}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-hairline px-3 text-[12px] font-semibold text-espresso transition hover:bg-cream-card disabled:opacity-40 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                {pdfBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />} PDF
              </button>
              <button
                onClick={save}
                disabled={saving || entries.length === 0}
                className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-espresso px-3.5 text-[12px] font-semibold text-cream transition hover:bg-caramel disabled:opacity-40 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                {saving ? "Gönderiliyor..." : "Kaydet & Öğrenciye Gönder"}
              </button>
            </div>
          </div>

          {/* --- Daha önce verilen programlar --- */}
          {history && history.length > 0 && (
            <section className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
              <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                <BookMarked className="h-3.5 w-3.5" /> Daha önce verilen programlar
              </h3>
              <div className="space-y-1.5">
                {history.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream-card px-3 py-2 dark:bg-white/5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-espresso dark:text-cream">{p.weekLabel}</span>
                      <span className="block text-[10.5px] text-espresso-muted dark:text-cream/40">
                        {p.entries.length} blok · {new Date(p.createdAt).toLocaleDateString("tr-TR")}
                      </span>
                    </span>
                    {/* Geçmiş programı taslağa kopyala — haftalar çoğu zaman
                        birbirinin üstüne kurulur, sıfırdan yazdırmak gereksiz. */}
                    <button
                      onClick={() => {
                        setEntries(
                          p.entries.map((e) => ({
                            key: newKey(),
                            day: (DAYS.includes(e.day as Day) ? e.day : "Pazartesi") as Day,
                            time: e.time,
                            subject: e.subject,
                            topic: e.topic,
                            questionTarget: e.questionTarget,
                          }))
                        );
                        showSuccess("Program taslağa kopyalandı — düzenleyip yeniden gönderebilirsiniz.");
                      }}
                      className="flex min-h-[34px] items-center gap-1 rounded-lg border border-hairline px-2.5 text-[11px] font-medium text-espresso transition hover:bg-white dark:border-white/10 dark:text-cream dark:hover:bg-white/10"
                    >
                      <Copy className="h-3 w-3" /> Kopyala
                    </button>
                    <button
                      onClick={() => downloadPdf(p.weekLabel, p.entries)}
                      disabled={pdfBusy}
                      className="flex min-h-[34px] items-center gap-1 rounded-lg border border-hairline px-2.5 text-[11px] font-medium text-espresso transition hover:bg-white disabled:opacity-40 dark:border-white/10 dark:text-cream dark:hover:bg-white/10"
                    >
                      <FileDown className="h-3 w-3" /> PDF
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {history?.length === 0 && entries.length === 0 && (
            <p className="rounded-2xl border border-hairline bg-white px-3 py-6 text-center text-xs text-espresso-muted dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream/40">
              Bu öğrenciye henüz program verilmemiş. Soldaki zayıf kazanımlardan &quot;+&quot; ile başlayabilirsiniz.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
