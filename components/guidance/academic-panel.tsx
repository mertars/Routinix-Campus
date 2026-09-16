"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BookMarked,
  CalendarCheck,
  ClipboardList,
  Loader2,
  PlayCircle,
  Scan,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// AKADEMİK DURUM — tam ekran, tek öğrencinin BÜTÜN sonuçları.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "akademik durum tuşuna basıldığında tam
// ekran bir tasarım yap, öğrencinin ödevlerini röntgenini yoklamasını vs.
// hepsini içeren bütün sonuçları gördüğü şık bir ekran olsun — yani
// Öğrenci 360'tan FARKLI bir panel".
//
// Öğrenci 360'tan farkı BİLİNÇLİ: 360 bir ÖZET karttır (her modülden tek
// sayı + o modüle giden kapı) ve kurum genelinde her yerden açılır. Bu
// ekran ise DERİNLİK: satır satır ödev, kazanım kazanım röntgen, gün gün
// yoklama. Rehber öğretmen görüşmeye bu ekranla girer.
//
// ⚠️ createPortal ZORUNLU: bu panel `transform`lu bir motion.div'in
// içinden açılıyor; transform'lu ata, içindeki position:fixed için yeni
// kapsayıcı blok yaratır ve panel tam ekran olmak yerine karta sıkışırdı.
// ----------------------------------------------------------------------------

type Academic = {
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    branchName: string | null;
    grade: number | null;
    track: string | null;
    advisorName: string | null;
  };
  attendance: {
    rate: number;
    counts: Record<string, number>;
    total: number;
    recent: { id: string; date: string; slot: string; subject: string; status: string }[];
  };
  homework: {
    total: number;
    done: number;
    rate: number | null;
    items: {
      id: string;
      title: string;
      status: string;
      dueAt: string | null;
      updatedAt: string;
      targetQuestionCount: number | null;
      teacherName: string;
      subject: string;
    }[];
  };
  xray: {
    averageMastery: number | null;
    weakCount: number;
    mastery: { id: string; subject: string; subtopicName: string; masteryScore: number; assessedAt: string; source: string }[];
    assignments: {
      id: string;
      subject: string;
      subtopicName: string;
      status: string;
      assignedAt: string;
      completedAt: string | null;
      flagReason: string | null;
      answered: number;
      correct: number;
    }[];
  };
  exams: { name: string; date: string | null; total: number; subjects: { subject: string; net: number }[] }[];
  videos: {
    id: string;
    title: string;
    subject: string;
    assignedAt: string;
    watchedAt: string | null;
    watchedSeconds: number | null;
    durationSeconds: number | null;
    watchedPercent: number | null;
  }[];
  programs: { id: string; weekLabel: string; createdAt: string; total: number; done: number }[];
};

type SectionId = "overview" | "homework" | "xray" | "attendance" | "exams" | "videos";

const SECTIONS: { id: SectionId; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Genel Bakış", icon: Activity },
  { id: "homework", label: "Ödevler", icon: ClipboardList },
  { id: "xray", label: "Akademik Röntgen", icon: Scan },
  { id: "attendance", label: "Yoklama", icon: CalendarCheck },
  { id: "exams", label: "Denemeler", icon: TrendingUp },
  { id: "videos", label: "Videolar", icon: PlayCircle },
];

const HOMEWORK_STATUS: Record<string, { label: string; className: string }> = {
  DONE: { label: "Yapıldı", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  HALF: { label: "Yarım", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  LATE: { label: "Geç teslim", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  NOT_DONE: { label: "Yapılmadı", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

const ATTENDANCE_STATUS: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "Geldi", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  ABSENT: { label: "Gelmedi", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  LATE: { label: "Geç geldi", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  EXCUSED: { label: "İzinli", className: "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/50" },
};

const XRAY_STATUS: Record<string, { label: string; className: string }> = {
  ASSIGNED: { label: "Atandı", className: "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/50" },
  IN_PROGRESS: { label: "Başladı", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  COMPLETED: { label: "Tamamlandı", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  FLAGGED: { label: "İşaretlendi", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short", weekday: "short" });
}
function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "—";
}
function watchLabel(seconds: number | null): string {
  if (!seconds) return "hiç izlenmedi";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}dk ${s}sn` : `${s}sn`;
}

/** Büyük rakam + ne anlama geldiğini söyleyen satır. */
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  detail: string;
  tone: "good" | "warn" | "bad" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3.5",
        tone === "bad"
          ? "border-rose-500/25 bg-rose-50/70 dark:border-rose-500/25 dark:bg-rose-500/10"
          : tone === "warn"
            ? "border-amber-500/25 bg-amber-50/70 dark:border-amber-500/25 dark:bg-amber-500/10"
            : tone === "good"
              ? "border-emerald-500/25 bg-emerald-50/70 dark:border-emerald-500/25 dark:bg-emerald-500/10"
              : "border-hairline bg-white dark:border-white/10 dark:bg-white/[0.04]"
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-espresso-muted dark:text-cream/40">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <p
        className={cn(
          "text-2xl font-bold leading-none tabular-nums",
          tone === "bad"
            ? "text-rose-700 dark:text-rose-300"
            : tone === "warn"
              ? "text-amber-700 dark:text-amber-300"
              : tone === "good"
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-espresso dark:text-cream"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-espresso-muted dark:text-cream/45">{detail}</p>
    </div>
  );
}

function SectionCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/60">
      <h3 className="text-[13px] font-bold text-espresso dark:text-cream">{title}</h3>
      {hint && <p className="mb-2.5 mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">{hint}</p>}
      <div className={cn(!hint && "mt-2.5")}>{children}</div>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="py-6 text-center text-[12px] text-espresso-muted dark:text-cream/40">{text}</p>;
}

/** 0-100 arası bir oranı çizen ince çubuk. */
function Bar({ percent, tone }: { percent: number; tone: "good" | "warn" | "bad" }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-espresso/10 dark:bg-white/10">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          tone === "bad" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : "bg-emerald-500"
        )}
        style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export function AcademicPanel({
  studentId,
  onClose,
  onWriteProgram,
}: {
  studentId: string;
  onClose: () => void;
  /** Panelden doğrudan aksiyona geçiş: zayıf kazanım görülüp program yazılır. */
  onWriteProgram?: (studentId: string) => void;
}) {
  const { showError } = useToast();
  const [data, setData] = useState<Academic | null>(null);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<SectionId>("overview");

  useEffect(() => {
    fetch(`/api/guidance/students/${studentId}/academic`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {
        setFailed(true);
        showError("Akademik durum yüklenemedi.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // Esc ile kapansın — tam ekran bir panelde kapatma tuşunu aramak zorunda
  // kalmak kullanışsız.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const netTrend = useMemo(() => {
    if (!data || data.exams.length < 2) return null;
    return Math.round((data.exams[0].total - data.exams[1].total) * 10) / 10;
  }, [data]);

  const body = (
    <div className="fixed inset-0 z-[130] flex flex-col bg-cream dark:bg-midnight">
      {/* ÜST ŞERİT — öğrenci künyesi hep görünür kalır */}
      <div className="shrink-0 border-b border-hairline bg-white/85 backdrop-blur-md dark:border-white/10 dark:bg-midnight-card/80">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-3 px-4 py-3 md:px-8">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-600">Akademik Durum</p>
            <h2 className="truncate text-lg font-bold leading-tight text-espresso dark:text-cream">
              {data?.student.name ?? "Yükleniyor…"}
            </h2>
            {data && (
              <p className="mt-0.5 truncate text-[11.5px] text-espresso-muted dark:text-cream/45">
                {data.student.branchName ?? "Şubesiz"}
                {data.student.studentNumber ? ` · No ${data.student.studentNumber}` : ""}
                {data.student.track ? ` · ${data.student.track}` : ""}
                {data.student.advisorName ? ` · Danışman: ${data.student.advisorName}` : ""}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {data && onWriteProgram && (
              <button
                onClick={() => {
                  onWriteProgram(data.student.id);
                  onClose();
                }}
                className="hidden min-h-[40px] items-center gap-1.5 rounded-xl bg-espresso px-3.5 text-[12px] font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500 sm:flex"
              >
                <BookMarked className="h-3.5 w-3.5" /> Program Yaz
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

        {/* BÖLÜM ŞERİDİ */}
        <div className="mx-auto max-w-6xl px-4 md:px-8">
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const active = s.id === section;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn(
                    "relative flex min-h-[44px] shrink-0 items-center gap-1.5 px-3 text-[12.5px] font-semibold transition",
                    active
                      ? "text-brand-600"
                      : "text-espresso-muted hover:text-espresso dark:text-cream/45 dark:hover:text-cream"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {s.label}
                  {active && <span className="absolute inset-x-1.5 bottom-0 h-[2.5px] rounded-full bg-brand-600" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* İÇERİK */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-5 md:px-8">
          {!data && !failed && (
            <div className="flex justify-center py-24">
              <Loader2 className="h-7 w-7 animate-spin text-brand-600" />
            </div>
          )}
          {failed && (
            <p className="py-24 text-center text-sm text-espresso-muted dark:text-cream/40">
              Akademik durum yüklenemedi.
            </p>
          )}

          {data && section === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                <Metric
                  icon={CalendarCheck}
                  label="Devam"
                  value={data.attendance.total > 0 ? `%${data.attendance.rate}` : "—"}
                  detail={
                    data.attendance.total > 0
                      ? `${data.attendance.total} ders kaydı · ${data.attendance.counts.ABSENT ?? 0} devamsızlık`
                      : "Henüz yoklama kaydı yok"
                  }
                  tone={
                    data.attendance.total === 0
                      ? "neutral"
                      : data.attendance.rate >= 90
                        ? "good"
                        : data.attendance.rate >= 80
                          ? "warn"
                          : "bad"
                  }
                />
                <Metric
                  icon={ClipboardList}
                  label="Ödev"
                  value={data.homework.rate !== null ? `%${data.homework.rate}` : "—"}
                  detail={
                    data.homework.total > 0
                      ? `${data.homework.total} ödevin ${data.homework.done} tanesi teslim`
                      : "Henüz ödev atanmamış"
                  }
                  tone={
                    data.homework.rate === null
                      ? "neutral"
                      : data.homework.rate >= 80
                        ? "good"
                        : data.homework.rate >= 60
                          ? "warn"
                          : "bad"
                  }
                />
                <Metric
                  icon={Scan}
                  label="Röntgen"
                  value={data.xray.averageMastery !== null ? `%${data.xray.averageMastery}` : "—"}
                  detail={
                    data.xray.averageMastery !== null
                      ? `${data.xray.mastery.length} kazanım ölçüldü · ${data.xray.weakCount} zayıf`
                      : "Henüz kazanım ölçümü yok"
                  }
                  tone={
                    data.xray.averageMastery === null
                      ? "neutral"
                      : data.xray.averageMastery >= 70
                        ? "good"
                        : data.xray.averageMastery >= 50
                          ? "warn"
                          : "bad"
                  }
                />
                <Metric
                  icon={netTrend !== null && netTrend < 0 ? TrendingDown : TrendingUp}
                  label="Son deneme"
                  value={data.exams[0] ? `${data.exams[0].total}` : "—"}
                  detail={
                    data.exams[0]
                      ? netTrend !== null
                        ? `${data.exams[0].name} · öncekine göre ${netTrend > 0 ? "+" : ""}${netTrend} net`
                        : `${data.exams[0].name} · ilk deneme`
                      : "Henüz deneme sonucu yok"
                  }
                  tone={netTrend === null ? "neutral" : netTrend > 0 ? "good" : netTrend < 0 ? "bad" : "neutral"}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <SectionCard
                  title="En zayıf kazanımlar"
                  hint="Röntgen ölçümünde en düşük puanlı beş kazanım — program bu satırlardan yazılır."
                >
                  {data.xray.mastery.length === 0 ? (
                    <EmptyLine text="Bu öğrencinin hiç kazanım ölçümü yok." />
                  ) : (
                    <div className="space-y-2">
                      {data.xray.mastery.slice(0, 5).map((m) => (
                        <div key={m.id}>
                          <div className="mb-1 flex items-baseline justify-between gap-2">
                            <p className="truncate text-[12px] font-medium text-espresso dark:text-cream">
                              {m.subtopicName}
                            </p>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">
                              %{m.masteryScore}
                            </span>
                          </div>
                          <Bar percent={m.masteryScore} tone={m.masteryScore < 50 ? "bad" : m.masteryScore < 70 ? "warn" : "good"} />
                          <p className="mt-0.5 text-[10px] text-espresso-muted/80 dark:text-cream/30">{m.subject}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Son çalışma programları" hint="Verilen programın ne kadarı gerçekten yapılmış.">
                  {data.programs.length === 0 ? (
                    <EmptyLine text="Bu öğrenciye henüz program yazılmamış." />
                  ) : (
                    <div className="space-y-2">
                      {data.programs.map((p) => {
                        const percent = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
                        return (
                          <div key={p.id}>
                            <div className="mb-1 flex items-baseline justify-between gap-2">
                              <p className="truncate text-[12px] font-medium text-espresso dark:text-cream">{p.weekLabel}</p>
                              <span className="shrink-0 text-[11px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">
                                {p.done}/{p.total}
                              </span>
                            </div>
                            <Bar percent={percent} tone={percent >= 70 ? "good" : percent >= 40 ? "warn" : "bad"} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>

              <SectionCard title="Yapılmayan ödevler" hint="Görüşmede ilk konuşulacak somut başlık.">
                {data.homework.items.filter((h) => h.status === "NOT_DONE").length === 0 ? (
                  <EmptyLine text="Teslim edilmemiş ödev yok." />
                ) : (
                  <div className="space-y-1.5">
                    {data.homework.items
                      .filter((h) => h.status === "NOT_DONE")
                      .slice(0, 6)
                      .map((h) => (
                        <div
                          key={h.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-rose-50/70 px-3 py-2 dark:bg-rose-500/10"
                        >
                          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-espresso dark:text-cream">
                            {h.title}
                          </p>
                          <span className="text-[10.5px] text-espresso-muted dark:text-cream/45">
                            {h.subject} · {h.teacherName} · son tarih {shortDate(h.dueAt)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {data && section === "homework" && (
            <SectionCard
              title={`Ödevler (${data.homework.done}/${data.homework.total} teslim)`}
              hint="En son güncellenen ödev en üstte."
            >
              {data.homework.items.length === 0 ? (
                <EmptyLine text="Bu öğrenciye henüz ödev atanmamış." />
              ) : (
                <div className="space-y-1.5">
                  {data.homework.items.map((h) => {
                    const st = HOMEWORK_STATUS[h.status] ?? { label: h.status, className: "bg-cream-card text-espresso-muted" };
                    return (
                      <div
                        key={h.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2.5 dark:border-white/10"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-espresso dark:text-cream">{h.title}</p>
                          <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">
                            {h.subject} · {h.teacherName}
                            {h.targetQuestionCount ? ` · hedef ${h.targetQuestionCount} soru` : ""}
                            {h.dueAt ? ` · son tarih ${shortDate(h.dueAt)}` : ""}
                          </p>
                        </div>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", st.className)}>
                          {st.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {data && section === "xray" && (
            <div className="space-y-3">
              <SectionCard
                title="Kazanım hâkimiyeti"
                hint="Akademik Röntgen ölçümü — en zayıf kazanım en üstte. Salt okunur: atama çalışma programından yapılır."
              >
                {data.xray.mastery.length === 0 ? (
                  <EmptyLine text="Bu öğrencinin hiç kazanım ölçümü yok." />
                ) : (
                  <div className="space-y-2.5">
                    {data.xray.mastery.map((m) => (
                      <div key={m.id}>
                        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-espresso dark:text-cream">
                            {m.subtopicName}
                          </p>
                          <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">
                            %{m.masteryScore}
                          </span>
                        </div>
                        <Bar percent={m.masteryScore} tone={m.masteryScore < 50 ? "bad" : m.masteryScore < 70 ? "warn" : "good"} />
                        <p className="mt-0.5 text-[10px] text-espresso-muted/80 dark:text-cream/30">
                          {m.subject} · {shortDate(m.assessedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Röntgen testleri" hint="Atanan anlama testleri ve sonuçları.">
                {data.xray.assignments.length === 0 ? (
                  <EmptyLine text="Bu öğrenciye hiç röntgen testi atanmamış." />
                ) : (
                  <div className="space-y-1.5">
                    {data.xray.assignments.map((a) => {
                      const st = XRAY_STATUS[a.status] ?? { label: a.status, className: "bg-cream-card text-espresso-muted" };
                      return (
                        <div
                          key={a.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2.5 dark:border-white/10"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-espresso dark:text-cream">
                              {a.subtopicName}
                            </p>
                            <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">
                              {a.subject} · atandı {shortDate(a.assignedAt)}
                              {a.completedAt ? ` · çözüldü ${shortDate(a.completedAt)}` : ""}
                              {a.answered > 0 ? ` · ${a.correct}/${a.answered} doğru` : ""}
                            </p>
                            {a.flagReason && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-medium text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="h-3 w-3" /> {a.flagReason}
                              </p>
                            )}
                          </div>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", st.className)}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {data && section === "attendance" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const).map((s) => (
                  <div key={s} className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-white/[0.04]">
                    <p className="text-xl font-bold tabular-nums text-espresso dark:text-cream">
                      {data.attendance.counts[s] ?? 0}
                    </p>
                    <p className="text-[10.5px] text-espresso-muted dark:text-cream/45">{ATTENDANCE_STATUS[s].label}</p>
                  </div>
                ))}
              </div>
              <SectionCard title="Son yoklama kayıtları" hint="En yeni kayıt en üstte — hangi gün, hangi saat, hangi ders.">
                {data.attendance.recent.length === 0 ? (
                  <EmptyLine text="Bu öğrenci için hiç yoklama kaydı yok." />
                ) : (
                  <div className="space-y-1">
                    {data.attendance.recent.map((r) => {
                      const st = ATTENDANCE_STATUS[r.status] ?? {
                        label: r.status,
                        className: "bg-cream-card text-espresso-muted",
                      };
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 odd:bg-cream-card/60 dark:odd:bg-white/[0.03]"
                        >
                          <span className="text-[12px] text-espresso dark:text-cream">{dayLabel(r.date)}</span>
                          <span className="min-w-0 flex-1 truncate text-[10.5px] text-espresso-muted dark:text-cream/40">
                            {[r.slot, r.subject].filter(Boolean).join(" · ")}
                          </span>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", st.className)}>
                            {st.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {data && section === "exams" && (
            <SectionCard title="Deneme sonuçları" hint="Toplam net ve ders bazlı kırılım — en yeni deneme en üstte.">
              {data.exams.length === 0 ? (
                <EmptyLine text="Bu öğrencinin hiç deneme sonucu yok." />
              ) : (
                <div className="space-y-2.5">
                  {data.exams.map((e, i) => {
                    const prev = data.exams[i + 1];
                    const delta = prev ? Math.round((e.total - prev.total) * 10) / 10 : null;
                    return (
                      <div key={e.name} className="rounded-xl border border-hairline p-3 dark:border-white/10">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12.5px] font-semibold text-espresso dark:text-cream">{e.name}</p>
                            <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">{shortDate(e.date)}</p>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-lg font-bold tabular-nums text-espresso dark:text-cream">{e.total}</span>
                            {delta !== null && (
                              <span
                                className={cn(
                                  "text-[11px] font-semibold tabular-nums",
                                  delta > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : delta < 0
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-espresso-muted dark:text-cream/40"
                                )}
                              >
                                {delta > 0 ? "+" : ""}
                                {delta}
                              </span>
                            )}
                          </div>
                        </div>
                        {e.subjects.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-hairline pt-2 dark:border-white/10">
                            {e.subjects.map((s) => (
                              <span
                                key={`${e.name}-${s.subject}`}
                                className="rounded-full bg-cream-card px-2 py-0.5 text-[10.5px] text-espresso-muted dark:bg-white/5 dark:text-cream/50"
                              >
                                {s.subject} <span className="font-bold tabular-nums">{s.net}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          )}

          {data && section === "videos" && (
            <SectionCard title="Atanan videolar" hint="Ne kadarının izlendiği saniye bazında takip edilir.">
              {data.videos.length === 0 ? (
                <EmptyLine text="Bu öğrenciye hiç video atanmamış." />
              ) : (
                <div className="space-y-2">
                  {data.videos.map((v) => (
                    <div key={v.id} className="rounded-xl border border-hairline p-3 dark:border-white/10">
                      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-espresso dark:text-cream">
                          {v.title}
                        </p>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-espresso-muted dark:text-cream/50">
                          {v.watchedPercent !== null ? `%${v.watchedPercent}` : "—"}
                        </span>
                      </div>
                      <Bar
                        percent={v.watchedPercent ?? 0}
                        tone={(v.watchedPercent ?? 0) >= 90 ? "good" : (v.watchedPercent ?? 0) > 0 ? "warn" : "bad"}
                      />
                      <p className="mt-1 text-[10.5px] text-espresso-muted dark:text-cream/40">
                        {v.subject} · {watchLabel(v.watchedSeconds)} izlendi · atandı {shortDate(v.assignedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {body}
    </motion.div>,
    document.body
  );
}
