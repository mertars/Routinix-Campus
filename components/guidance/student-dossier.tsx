"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  Activity,
  BookMarked,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  FileText,
  LineChart,
  Loader2,
  NotebookPen,
  Phone,
  ShieldAlert,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AcademicPanel } from "@/components/guidance/academic-panel";
import { MeetingImpactPanel } from "@/components/guidance/meeting-impact-panel";
import { GUIDANCE_CATEGORY_LABEL } from "@/lib/guidance/categories";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
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
  PUBLIC: "Veliyle paylaşıldı",
  RESTRICTED: "Kurum içi",
  CONFIDENTIAL: "Yalnızca rehberlik",
};

// ⚠️ Gizlilik seviyesinin NE İŞE YARADIĞI kullanıcıya hiçbir yerde
// yazmıyordu (Mert: "bunların anlamını ben bile tam bilmiyorum").
// Metinler kodun GERÇEK davranışını anlatır, bkz. lib/guidance/visibility.ts.
const CONFIDENTIALITY_EXPLAIN: Record<string, string> = {
  PUBLIC: "Bu not velinin panelinde görünür — veliyle paylaşılmak üzere yazılmıştır.",
  RESTRICTED: "Bu notu veli GÖREMEZ; kurum içinde yönetici ve rehberlik okuyabilir.",
  CONFIDENTIAL: "Bu not yalnızca rehberliğe açıktır; yönetici akışında bile görünmez.",
};



const PROGRAM_DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
const PROGRAM_KIND_LABEL: Record<string, string> = {
  QUESTION: "Soru çözümü",
  TOPIC_STUDY: "Konu çalışması",
  VIDEO: "Video ders",
  XRAY_TEST: "Röntgen testi",
};

type PastProgramEntry = {
  id: string;
  day: string;
  time: string | null;
  subject: string;
  topic: string | null;
  kind: string;
  questionTarget: number | null;
  note: string | null;
  done: boolean;
  video: { title: string } | null;
};
type PastProgram = { id: string; weekLabel: string; entries: PastProgramEntry[] };

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ----------------------------------------------------------------------------
// GEÇMİŞ KAYIT DETAYI — dosya geçmişindeki satıra tıklanınca açılır.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "dosya geçmişi kısmı var ama tıklanmıyor,
// onlar tıklansın ve eskiden nasıl planlama yapmış görebilsin". Zaman
// tünelinde program satırı sadece "12 çalışma bloğu" yazıyordu — rehber
// geçen hafta ne verdiğini göremediği için yeni programı sıfırdan
// düşünmek zorunda kalıyordu.
//
// ⚠️ createPortal ZORUNLU: bu bileşen `transform` uygulanmış bir
// motion.div'in içinde render ediliyor ve transform'lu bir ata, içindeki
// `position: fixed` için yeni bir kapsayıcı blok yaratır — panel ekranın
// ortası yerine kartın içine sıkışırdı (bu tuzağa bu kod tabanında daha
// önce renk paletinde düşülmüştü).
function TimelineDetailModal({
  item,
  studentId,
  onClose,
}: {
  item: TimelineItem;
  studentId: string;
  onClose: () => void;
}) {
  const { showError } = useToast();
  const [program, setProgram] = useState<PastProgram | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (item.kind !== "program") return;
    // Program blokları zaten var olan uçtan gelir (GET /api/guidance-program
    // tüm programları entry'leriyle döner) — yeni bir uç açmaya gerek yok.
    fetch(`/api/guidance-program?studentId=${encodeURIComponent(studentId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { programs: PastProgram[] }) => {
        const found = d.programs?.find((p) => p.id === item.id) ?? null;
        if (found) setProgram(found);
        else setLoadFailed(true);
      })
      .catch(() => setLoadFailed(true));
  }, [item, studentId]);

  const style = KIND_STYLE[item.kind];
  const Icon = style.icon;

  const byDay = program
    ? PROGRAM_DAYS.map((day) => ({ day, entries: program.entries.filter((e) => e.day === day) })).filter(
        (g) => g.entries.length > 0
      )
    : [];
  const doneCount = program?.entries.filter((e) => e.done).length ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-espresso/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-hairline bg-cream p-5 shadow-2xl dark:border-white/10 dark:bg-midnight sm:rounded-3xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-2.5">
            <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", style.className)}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                {style.label}
              </p>
              <h3 className="text-base font-bold leading-tight text-espresso dark:text-cream">{item.title}</h3>
              <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                {whenLabel(item.at)}
                {item.author ? ` · ${item.author}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Görüşme / not: rozetler + tam metin */}
        {item.kind !== "program" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {item.status && (
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", MEETING_STATUS[item.status]?.className)}>
                  {MEETING_STATUS[item.status]?.label ?? item.status}
                </span>
              )}
              {item.attendee && (
                <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <Users className="h-3 w-3" /> {ATTENDEE_LABEL[item.attendee] ?? item.attendee}
                </span>
              )}
              {item.category && (
                <span className="rounded-full bg-cream-card px-2 py-0.5 text-[11px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/50">
                  {GUIDANCE_CATEGORY_LABEL[item.category as keyof typeof GUIDANCE_CATEGORY_LABEL] ?? item.category}
                </span>
              )}
              {item.confidentiality && (
                <span className="flex items-center gap-1 rounded-full bg-cream-card px-2 py-0.5 text-[11px] font-semibold text-espresso-muted dark:bg-white/10 dark:text-cream/50">
                  <ShieldAlert className="h-3 w-3" /> {CONFIDENTIALITY_LABEL[item.confidentiality] ?? item.confidentiality}
                </span>
              )}
            </div>
            <div className="rounded-2xl border border-hairline bg-white p-4 text-[13px] leading-relaxed text-espresso dark:border-white/10 dark:bg-midnight-card/60 dark:text-cream/80">
              {item.detail ? (
                <p className="whitespace-pre-wrap">{item.detail}</p>
              ) : (
                <p className="text-espresso-muted dark:text-cream/40">
                  {item.kind === "meeting"
                    ? "Bu görüşmeye henüz sonuç notu yazılmamış."
                    : "Not içeriği boş."}
                </p>
              )}
            </div>
            {item.kind === "note" && item.confidentiality && (
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                {CONFIDENTIALITY_EXPLAIN[item.confidentiality] ?? ""}
              </p>
            )}
          </div>
        )}

        {/* Program: hangi gün ne verilmiş, ne kadarı yapılmış */}
        {item.kind === "program" && (
          <div className="space-y-3">
            {!program && !loadFailed && (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              </div>
            )}
            {loadFailed && (
              <p className="py-8 text-center text-sm text-espresso-muted dark:text-cream/40">Program detayı yüklenemedi.</p>
            )}
            {program && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {doneCount}/{program.entries.length} blok yapıldı
                  </span>
                  {/* ⚠️ PDF ucu POST + gövde ister (GET değil) ve indirme
                      fetchAndDownloadPdf üzerinden yapılır — window.open bir
                      await'ten sonra popup engelleyiciye takılıyordu. */}
                  <button
                    type="button"
                    disabled={pdfBusy}
                    onClick={async () => {
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
                                time: e.time ?? "",
                                subject: e.subject,
                                topic: e.topic ?? "",
                                questionTarget: e.questionTarget ?? 0,
                              })),
                            }),
                          },
                          `calisma-programi-${program.weekLabel}.pdf`
                        );
                      } catch (error) {
                        showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
                      } finally {
                        setPdfBusy(false);
                      }
                    }}
                    className="flex min-h-[32px] items-center gap-1.5 rounded-full border border-hairline px-3 text-[11px] font-semibold text-espresso-muted transition hover:border-brand-500/40 hover:text-brand-600 disabled:opacity-50 dark:border-white/10 dark:text-cream/55"
                  >
                    <FileText className="h-3 w-3" /> {pdfBusy ? "Hazırlanıyor..." : "PDF"}
                  </button>
                </div>
                {byDay.length === 0 ? (
                  <p className="py-8 text-center text-sm text-espresso-muted dark:text-cream/40">
                    Bu programda hiç blok yok.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {byDay.map((group) => (
                      <div key={group.day} className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-midnight-card/60">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                          {group.day}
                        </p>
                        <div className="space-y-1.5">
                          {group.entries.map((e) => (
                            <div
                              key={e.id}
                              className={cn(
                                "flex items-start gap-2 rounded-xl px-2.5 py-2",
                                e.done ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-cream-card dark:bg-white/5"
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                                  e.done ? "bg-emerald-500 text-white" : "border border-espresso/20 dark:border-white/20"
                                )}
                              >
                                {e.done ? "✓" : ""}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12.5px] font-medium text-espresso dark:text-cream">
                                  {e.subject}
                                  {e.topic ? ` · ${e.topic}` : ""}
                                </p>
                                <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">
                                  {[
                                    PROGRAM_KIND_LABEL[e.kind] ?? null,
                                    e.time || null,
                                    e.questionTarget ? `${e.questionTarget} soru` : null,
                                    e.video?.title ?? null,
                                    e.note || null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
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
  // Dosya geçmişinde tıklanan satır — detay penceresinde açılır.
  const [detailItem, setDetailItem] = useState<TimelineItem | null>(null);
  const [academicOpen, setAcademicOpen] = useState(false);
  const [impactOpen, setImpactOpen] = useState(false);

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
          {/* ⚠️ ARTIK Öğrenci 360 kartını DEĞİL, tam ekran Akademik Durum
              panelini açar (Mert: "öğrenci 360'tan farklı bir panel
              bekliyorum... ödevlerini röntgenini yoklamasını vs. hepsini
              içeren"). 360 bir özet karttı ve rehberliğin ulaşamadığı
              modüllere (örn. /xray/principal) kapı açıyordu. */}
          <button
            onClick={() => setAcademicOpen(true)}
            className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-50/60 px-3 text-[11.5px] font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-brand-500/30 dark:bg-brand-600/10 dark:text-brand-300 dark:hover:bg-brand-600/20"
          >
            <LineChart className="h-3.5 w-3.5" /> Akademik Durum
          </button>
          {/* ⚠️ GÖRÜŞME ETKİSİ (Mert, 2026-09-16): rehberliğin yaptığı iş
              ilk kez ölçülüyor — görüşme öncesi/sonrası 30 günün devam,
              ödev ve net karşılaştırması. Veliyle paylaşılan notların
              okunup okunmadığı da bu ekranın içinde. */}
          <button
            onClick={() => setImpactOpen(true)}
            className="flex min-h-[36px] items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-50/60 px-3 text-[11.5px] font-semibold text-violet-700 transition hover:bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300 dark:hover:bg-violet-500/20"
          >
            <Activity className="h-3.5 w-3.5" /> Görüşme Etkisi
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
                <motion.button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => setDetailItem(item)}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.02 }}
                  // ⚠️ Satırın tamamı tıklanabilir (Mert: "dosya geçmişi
                  // tıklanmıyor") — detay penceresi geçmiş programın hangi
                  // gün ne verdiğini gösterir.
                  className="group flex w-full gap-2.5 rounded-2xl border border-hairline bg-white px-3 py-2.5 text-left transition hover:border-brand-500/40 hover:shadow-sm dark:border-white/10 dark:bg-midnight-card/50"
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
                      <span className="ml-1.5 font-semibold text-brand-600 opacity-0 transition group-hover:opacity-100">
                        detayı aç
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="mt-2 h-4 w-4 shrink-0 self-start text-espresso-muted/50 transition group-hover:translate-x-0.5 group-hover:text-brand-600 dark:text-cream/25" />
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {detailItem && (
        <TimelineDetailModal item={detailItem} studentId={student.id} onClose={() => setDetailItem(null)} />
      )}

      {impactOpen && <MeetingImpactPanel studentId={student.id} onClose={() => setImpactOpen(false)} />}

      {academicOpen && (
        <AcademicPanel
          studentId={student.id}
          onClose={() => setAcademicOpen(false)}
          onWriteProgram={onWriteProgram ? () => onWriteProgram() : undefined}
        />
      )}
    </div>
  );
}
