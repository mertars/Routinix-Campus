"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  CalendarX2,
  HelpCircle,
  Loader2,
  Rocket,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useIsMobile } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

// ÖĞRETMENE ÖZEL ÖĞRENCİ KARTI.
//
// Kullanıcı kararı (2026-09-15): *"öğretmen için özelleşmiş bir kart olmalı,
// ödeme filan değil — kendi dersi için netleri nasıl, röntgen başarısı nasıl,
// kazanım kazanım, kendi dersinde devamsızlığı nasıl, kaç ödevi yapmış neyi
// yapmamış."*
//
// ⚠️ Yöneticinin Öğrenci 360 kartından (components/shared/student-360-sheet)
// BİLEREK ayrı: burada finans bölümü YOK ve her sayı öğretmenin KENDİ
// DERSİYLE sınırlı. Bir matematik öğretmeni bu kartta yalnızca matematik
// netini, matematik kazanımlarını ve kendi verdiği ödevleri görür.
//
// Bölüm sırası öğretmenin sorma sırasına göre: "dersime geliyor mu" →
// "neti ne durumda" → "hangi konuda zayıf" → "ödevlerini yapıyor mu".

type Card = {
  student: { id: string; name: string; branchName: string; studentNumber: string };
  subject: string;
  attendance: {
    rate: number | null;
    present: number;
    absent: number;
    late: number;
    excused: number;
    recentAbsences: { date: string; slot: string }[];
  };
  nets: { exams: { examName: string; date: string; net: number }[]; latest: number | null; delta: number | null; best: number | null };
  mastery: { average: number | null; topics: { subtopicId: string; name: string; score: number; assessedAt: string }[]; weakCount: number };
  homework: { total: number; done: number; half: number; late: number; notDone: number; missing: { title: string; dueAt: string | null }[] };
  engagement: { quizCount: number; quizAccuracy: number | null; questionsAsked: number; questionsPending: number };
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
      <p className="text-[10px] uppercase tracking-wide text-espresso-muted dark:text-cream/40">{label}</p>
      <p
        className={cn(
          "text-lg font-bold tabular-nums",
          tone === "good" && "text-green-600 dark:text-green-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "bad" && "text-rose-600 dark:text-rose-400",
          !tone && "text-espresso dark:text-cream"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hairline p-3.5 dark:border-white/10">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[13px] font-semibold text-espresso dark:text-cream">
        <Icon className="h-3.5 w-3.5 text-brand-600" /> {title}
      </h3>
      {children}
    </section>
  );
}

function masteryTone(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export function TeacherStudentCardSheet({
  studentId,
  onClose,
}: {
  studentId: string | null;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setCard(null);
      return;
    }
    setCard(null);
    setError(false);
    fetch(`/api/teacher/student-card/${studentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setCard(d.card))
      .catch(() => setError(true));
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [studentId, onClose]);

  if (typeof document === "undefined") return null;

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-hairline px-4 pb-3 pt-4 dark:border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-espresso dark:text-cream">
              {card?.student.name ?? "Yükleniyor..."}
            </h2>
            {card && (
              <p className="text-[11.5px] text-espresso-muted dark:text-cream/45">
                {card.student.branchName} · No {card.student.studentNumber} ·{" "}
                <span className="font-medium text-brand-600 dark:text-brand-400">{card.subject}</span> dersiniz
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/45 dark:hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {!card && !error && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-espresso-muted dark:text-cream/40" />
          </div>
        )}
        {error && (
          <p className="py-16 text-center text-sm text-espresso-muted dark:text-cream/40">Kart yüklenemedi.</p>
        )}

        {card && (
          <>
            {/* 1 — Dersime geliyor mu */}
            <Section icon={CalendarX2} title={`${card.subject} dersinde devamsızlık`}>
              <div className="grid grid-cols-4 gap-2">
                <Stat
                  label="Katılım"
                  value={card.attendance.rate === null ? "—" : `%${card.attendance.rate}`}
                  tone={card.attendance.rate === null ? undefined : card.attendance.rate >= 90 ? "good" : card.attendance.rate >= 75 ? "warn" : "bad"}
                />
                <Stat label="Gelmedi" value={String(card.attendance.absent)} tone={card.attendance.absent > 0 ? "bad" : undefined} />
                <Stat label="Geç" value={String(card.attendance.late)} tone={card.attendance.late > 0 ? "warn" : undefined} />
                <Stat label="İzinli" value={String(card.attendance.excused)} />
              </div>
              {card.attendance.recentAbsences.length > 0 && (
                <p className="mt-2 text-[11px] text-espresso-muted dark:text-cream/40">
                  Son gelmedikleri:{" "}
                  {card.attendance.recentAbsences
                    .map((a) => `${new Date(a.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} ${a.slot}`)
                    .join(" · ")}
                </p>
              )}
              {card.attendance.rate === null && (
                <p className="mt-2 text-[11px] text-espresso-muted dark:text-cream/40">
                  Bu derste henüz yoklama kaydı yok.
                </p>
              )}
            </Section>

            {/* 2 — Neti ne durumda */}
            <Section icon={Target} title={`${card.subject} netleri`}>
              {card.nets.exams.length === 0 ? (
                <p className="text-[11.5px] text-espresso-muted dark:text-cream/40">
                  Bu derste işlenmiş deneme sonucu yok.
                </p>
              ) : (
                <>
                  <div className="mb-2 grid grid-cols-3 gap-2">
                    <Stat label="Son net" value={card.nets.latest?.toFixed(2) ?? "—"} />
                    <Stat
                      label="Değişim"
                      value={card.nets.delta === null ? "—" : `${card.nets.delta > 0 ? "+" : ""}${card.nets.delta.toFixed(2)}`}
                      tone={card.nets.delta === null ? undefined : card.nets.delta >= 0 ? "good" : "bad"}
                    />
                    <Stat label="En iyi" value={card.nets.best?.toFixed(2) ?? "—"} />
                  </div>
                  <div className="space-y-1">
                    {card.nets.exams.slice(0, 5).map((e, i) => (
                      <div key={`${e.examName}-${i}`} className="flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="min-w-0 flex-1 truncate text-espresso dark:text-cream">{e.examName}</span>
                        <span className="shrink-0 text-espresso-muted dark:text-cream/40">
                          {new Date(e.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                        </span>
                        <span className="w-12 shrink-0 text-right font-semibold tabular-nums text-espresso dark:text-cream">
                          {e.net.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>

            {/* 3 — Hangi kazanımda zayıf */}
            <Section icon={card.mastery.weakCount > 0 ? TrendingDown : TrendingUp} title="Kazanım kazanım başarı">
              {card.mastery.topics.length === 0 ? (
                <p className="text-[11.5px] text-espresso-muted dark:text-cream/40">
                  Bu derste henüz kazanım ölçümü yok (Akademik Röntgen testi çözülmemiş).
                </p>
              ) : (
                <>
                  <div className="mb-2.5 flex items-center gap-2">
                    <Stat label="Ortalama" value={`%${card.mastery.average}`} tone={(card.mastery.average ?? 0) >= 70 ? "good" : (card.mastery.average ?? 0) >= 50 ? "warn" : "bad"} />
                    <Stat label="Zayıf kazanım" value={String(card.mastery.weakCount)} tone={card.mastery.weakCount > 0 ? "bad" : "good"} />
                  </div>
                  {/* En zayıf önce — öğretmenin işi orada başlar. */}
                  <div className="space-y-1.5">
                    {card.mastery.topics.slice(0, 10).map((t) => (
                      <div key={t.subtopicId} className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-espresso dark:text-cream">{t.name}</span>
                        <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                          <span className={cn("block h-full rounded-full", masteryTone(t.score))} style={{ width: `${t.score}%` }} />
                        </span>
                        <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-espresso-muted dark:text-cream/45">
                          %{t.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Section>

            {/* 4 — Ödevlerini yapıyor mu */}
            <Section icon={BookOpen} title="Verdiğiniz ödevler">
              <div className="grid grid-cols-4 gap-2">
                <Stat label="Yapıldı" value={String(card.homework.done)} tone="good" />
                <Stat label="Yarım" value={String(card.homework.half)} tone={card.homework.half > 0 ? "warn" : undefined} />
                <Stat label="Geç" value={String(card.homework.late)} tone={card.homework.late > 0 ? "warn" : undefined} />
                <Stat label="Yapılmadı" value={String(card.homework.notDone)} tone={card.homework.notDone > 0 ? "bad" : undefined} />
              </div>
              {card.homework.missing.length > 0 && (
                <div className="mt-2 rounded-xl bg-rose-50/70 px-3 py-2 dark:bg-rose-500/10">
                  <p className="mb-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">Yapılmayanlar</p>
                  <div className="space-y-0.5">
                    {card.homework.missing.map((m, i) => (
                      <p key={`${m.title}-${i}`} className="truncate text-[11.5px] text-espresso dark:text-cream">
                        {m.title}
                        {m.dueAt && (
                          <span className="text-espresso-muted dark:text-cream/40">
                            {" "}· son {new Date(m.dueAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {card.homework.total === 0 && (
                <p className="mt-2 text-[11px] text-espresso-muted dark:text-cream/40">Bu öğrenciye henüz ödev vermediniz.</p>
              )}
            </Section>

            {/* 5 — Derse katılımı */}
            <Section icon={Rocket} title="Derse katılım">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Pop-Quiz" value={String(card.engagement.quizCount)} />
                <Stat
                  label="Quiz doğruluk"
                  value={card.engagement.quizAccuracy === null ? "—" : `%${card.engagement.quizAccuracy}`}
                  tone={card.engagement.quizAccuracy === null ? undefined : card.engagement.quizAccuracy >= 60 ? "good" : "warn"}
                />
                <Stat label="Size sorduğu" value={String(card.engagement.questionsAsked)} />
              </div>
              {card.engagement.questionsPending > 0 && (
                <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                  <HelpCircle className="h-3 w-3" /> {card.engagement.questionsPending} sorusu hâlâ yanıtınızı bekliyor
                </p>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(
    <AnimatePresence>
      {studentId && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[80] bg-espresso/25 backdrop-blur-[2px] dark:bg-black/50"
          />
          {isMobile ? (
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-x-0 bottom-0 z-[90] flex max-h-[88vh] flex-col rounded-t-3xl border-t border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
              style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            >
              <div className="flex shrink-0 justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-hairline dark:bg-white/20" />
              </div>
              {body}
            </motion.div>
          ) : (
            <motion.div
              key="drawer"
              initial={{ x: "100%", opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0.6 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[460px] flex-col border-l border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
            >
              {body}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
