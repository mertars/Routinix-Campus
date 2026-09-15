"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BookMarked,
  CalendarClock,
  CalendarPlus,
  FileText,
  LineChart,
  Loader2,
  NotebookPen,
  Phone,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { openStudent360 } from "@/lib/student-360-store";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// ÖĞRENCİ REHBERLİK DOSYASI — "bu öğrenci hakkında bildiğim her şey", tek ekran.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): "rehberlik sistemi hâlâ çok ilkel ve
// tasarım anlamında kullanışsız... görüşme geçmişleri, notlar, verilen
// programlar vs. hepsi bulunsun". Üç kaynak da zaten vardı ama ayrı ayrı
// duruyordu; rehber öğretmen görüşmeye girerken geçmişi parça parça
// aramak zorundaydı.
//
// Asıl tasarım kararı ZAMAN TÜNELİ: görüşme, not ve program TEK kronolojide
// okunur. "Şu görüşmeden sonra bu programı verdim, iki hafta sonra yine
// görüştüm" ancak böyle görülür — üç ayrı listede asla.
// ----------------------------------------------------------------------------

type TimelineItem = {
  kind: "meeting" | "note" | "program";
  id: string;
  at: string;
  title: string;
  detail: string | null;
  status?: string;
  attendee?: string;
  category?: string;
  confidentiality?: string;
  author?: string;
  entryCount?: number;
};

type Dossier = {
  student: {
    id: string;
    name: string;
    studentNumber: string | null;
    branchName: string | null;
    grade: number | null;
    track: string | null;
    advisorName: string | null;
    parents: { name: string; phone: string }[];
  };
  academic: { attendanceRate: number; absentCount: number; exams: { name: string; date: string | null; net: number }[] };
  counts: { meetings: number; notes: number; programs: number };
  timeline: TimelineItem[];
};

const KIND_STYLE: Record<TimelineItem["kind"], { label: string; icon: typeof CalendarClock; className: string }> = {
  meeting: { label: "Görüşme", icon: CalendarClock, className: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300" },
  note: { label: "Not", icon: NotebookPen, className: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  program: { label: "Program", icon: BookMarked, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

const MEETING_STATUS: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Planlandı", className: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300" },
  DONE: { label: "Yapıldı", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  NO_SHOW: { label: "Gelmedi", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  CANCELLED: { label: "İptal", className: "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40" },
};

const ATTENDEE_LABEL: Record<string, string> = { STUDENT: "Öğrenci", PARENT: "Veli", BOTH: "Öğrenci + Veli" };
const CONFIDENTIALITY_LABEL: Record<string, string> = {
  PUBLIC: "Açık",
  RESTRICTED: "Kısıtlı",
  CONFIDENTIAL: "Gizli",
};

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "warn" | "bad" }) {
  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2",
        tone === "bad"
          ? "bg-rose-50 dark:bg-rose-500/10"
          : tone === "warn"
            ? "bg-amber-50 dark:bg-amber-500/10"
            : "bg-cream-card dark:bg-white/5"
      )}
    >
      <p
        className={cn(
          "text-base font-bold tabular-nums",
          tone === "bad" ? "text-rose-700 dark:text-rose-300" : tone === "warn" ? "text-amber-800 dark:text-amber-300" : "text-espresso dark:text-cream"
        )}
      >
        {value}
      </p>
      <p className="text-[10.5px] text-espresso-muted dark:text-cream/45">{label}</p>
    </div>
  );
}

export function StudentDossier({
  studentId,
  onPlanMeeting,
  onWriteProgram,
  refreshKey,
  children,
}: {
  studentId: string;
  onPlanMeeting: () => void;
  onWriteProgram: () => void;
  /** Dışarıdan bir kayıt eklendiğinde (görüşme/not/program) tazelensin. */
  refreshKey?: number;
  /** Künye/özet ile zaman tüneli ARASINA giren bölüm (açık sevkler, not
   *  yazma kutusu). Sıralama önemli: rehber önce kimle konuştuğunu ve
   *  durumunu görür, sonra eylemi yapar, sonra geçmişi okur. */
  children?: React.ReactNode;
}) {
  const { showError } = useToast();
  const [data, setData] = useState<Dossier | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setData(null);
    setFailed(false);
    fetch(`/api/guidance/students/${studentId}/dossier`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => {
        setFailed(true);
        showError("Öğrenci dosyası yüklenemedi.");
      });
  }, [studentId, showError]);

  useEffect(load, [load, refreshKey]);

  if (failed) {
    return <p className="py-10 text-center text-sm text-espresso-muted dark:text-cream/40">Dosya yüklenemedi.</p>;
  }
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const { student, academic, counts, timeline } = data;
  const lastExam = academic.exams[0];

  return (
    <div className="space-y-4">
      {/* --- Kimlik + hızlı eylemler --- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-espresso dark:text-cream">
            <UserRound className="h-4 w-4 text-brand-600" /> {student.name}
          </h2>
          <p className="mt-0.5 text-[11.5px] text-espresso-muted dark:text-cream/45">
            {student.branchName ?? "Şubesiz"}
            {student.studentNumber ? ` · No ${student.studentNumber}` : ""}
            {student.track ? ` · ${student.track}` : ""}
            {student.advisorName ? ` · Danışman: ${student.advisorName}` : " · danışman atanmamış"}
          </p>
          {student.parents.length > 0 && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-espresso-muted dark:text-cream/40">
              <Phone className="h-3 w-3" />
              {student.parents.map((p) => `${p.name} ${p.phone}`).join(" · ")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={onPlanMeeting}
            className="flex min-h-[36px] items-center gap-1.5 rounded-xl bg-espresso px-3 text-[11.5px] font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <CalendarPlus className="h-3.5 w-3.5" /> Görüşme Planla
          </button>
          <button
            onClick={onWriteProgram}
            className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-hairline px-3 text-[11.5px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <BookMarked className="h-3.5 w-3.5" /> Program Yaz
          </button>
          <button
            onClick={() => openStudent360(student.id)}
            className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-hairline px-3 text-[11.5px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <LineChart className="h-3.5 w-3.5" /> Akademik Durum
          </button>
        </div>
      </div>

      {/* --- Akademik özet: görüşmeye veriyle girmek için --- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="Devam oranı"
          value={`%${academic.attendanceRate}`}
          tone={academic.attendanceRate < 75 ? "bad" : academic.attendanceRate < 90 ? "warn" : undefined}
        />
        <StatTile label="Devamsızlık" value={String(academic.absentCount)} tone={academic.absentCount >= 10 ? "warn" : undefined} />
        <StatTile label="Son deneme neti" value={lastExam ? String(lastExam.net) : "—"} />
        <StatTile label="Görüşme sayısı" value={String(counts.meetings)} />
      </div>

      {academic.exams.length > 1 && (
        <div className="overflow-x-auto rounded-xl border border-hairline dark:border-white/10">
          <div className="flex min-w-max divide-x divide-hairline dark:divide-white/10">
            {academic.exams.map((e) => (
              <div key={e.name} className="px-3 py-2">
                <p className="text-sm font-bold tabular-nums text-espresso dark:text-cream">{e.net}</p>
                <p className="max-w-[9rem] truncate text-[10.5px] text-espresso-muted dark:text-cream/45">{e.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {children}

      {/* --- Zaman tüneli --- */}
      <div>
        <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
          <FileText className="h-3.5 w-3.5" /> Dosya geçmişi
          <span className="rounded-full bg-cream-card px-1.5 text-[10px] tabular-nums dark:bg-white/10">
            {counts.meetings} görüşme · {counts.notes} not · {counts.programs} program
          </span>
        </h3>

        {timeline.length === 0 ? (
          <p className="rounded-2xl border border-hairline bg-white px-3 py-8 text-center text-xs text-espresso-muted dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream/40">
            Bu öğrenciyle henüz hiç görüşme, not veya program kaydı yok.
          </p>
        ) : (
          <div className="space-y-2">
            {timeline.map((item, i) => {
              const style = KIND_STYLE[item.kind];
              const Icon = style.icon;
              return (
                <motion.div
                  key={`${item.kind}-${item.id}`}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.02 }}
                  className="flex gap-2.5 rounded-2xl border border-hairline bg-white px-3 py-2.5 dark:border-white/10 dark:bg-midnight-card/50"
                >
                  <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", style.className)}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-espresso dark:text-cream">{item.title}</span>
                      {item.kind === "meeting" && item.status && (
                        <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", MEETING_STATUS[item.status]?.className)}>
                          {MEETING_STATUS[item.status]?.label ?? item.status}
                        </span>
                      )}
                      {item.kind === "meeting" && item.attendee && item.attendee !== "STUDENT" && (
                        <span className="flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                          <Users className="h-2.5 w-2.5" /> {ATTENDEE_LABEL[item.attendee]}
                        </span>
                      )}
                      {item.kind === "note" && item.confidentiality && item.confidentiality !== "PUBLIC" && (
                        <span className="flex items-center gap-1 rounded-full bg-cream-card px-1.5 py-0.5 text-[10px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/45">
                          <ShieldAlert className="h-2.5 w-2.5" /> {CONFIDENTIALITY_LABEL[item.confidentiality]}
                        </span>
                      )}
                    </div>
                    {item.detail && (
                      <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] leading-snug text-espresso-muted dark:text-cream/50">
                        {item.detail}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10.5px] text-espresso-muted/80 dark:text-cream/35">
                      {whenLabel(item.at)}
                      {item.author ? ` · ${item.author}` : ""}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
