"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Flame as FlameIcon, Megaphone, ExternalLink, Timer, Landmark } from "lucide-react";
import { NATIONWIDE_EXAMS, type NationwideExamScope } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

type CampusEventEntry = { id: string; title: string; content: string; createdAt: string };

const SCOPE_STYLES: Record<NationwideExamScope, string> = {
  YKS: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-400",
  LGS: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400",
};

function useDaysUntil(dateStr: string) {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diffDays = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
  return diffDays;
}

function NationwideExamCard({ exam, index }: { exam: (typeof NATIONWIDE_EXAMS)[number]; index: number }) {
  const daysLeft = useDaysUntil(exam.date);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="flex flex-col justify-between rounded-2xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold", SCOPE_STYLES[exam.scope])}>
            {exam.scope} Kapsamı
          </span>
          <span className="shrink-0 rounded-full bg-cream-card px-2 py-0.5 text-[10px] font-medium text-espresso-muted dark:bg-white/10 dark:text-cream/50">
            {exam.date}
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-espresso dark:text-cream">
          <Landmark className="h-3.5 w-3.5 shrink-0 text-brand-600" /> {exam.organizer}
        </p>
        <p className="text-xs text-espresso-muted dark:text-cream/40">{exam.name}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 rounded-full bg-espresso px-2.5 py-1 text-[11px] font-semibold text-cream dark:bg-cream dark:text-espresso">
          <Timer className="h-3 w-3" />
          {daysLeft > 0 ? `${daysLeft} gün kaldı` : daysLeft === 0 ? "Bugün" : "Tamamlandı"}
        </span>
        <a
          href={exam.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-full border border-brand-600/40 px-2.5 py-1 text-[11px] font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-600/10"
        >
          {exam.linkLabel} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </motion.div>
  );
}

export function CampusCalendarTab() {
  const [events, setEvents] = useState<CampusEventEntry[]>([]);

  useEffect(() => {
    fetch("/api/announcements")
      .then((res) => res.json())
      .then((data) => setEvents((data.announcements ?? []).filter((a: { category: string }) => a.category === "EVENT")))
      .catch(() => {
        // sessiz — bölüm boş görünür
      });
  }, []);

  return (
    <div className="space-y-6">
      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Türkiye Geneli Deneme Takvimi</h2>
        <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">
          TÖDER, Özdebir, Bilgi Sarmal ve 3D Yayınları&apos;nın ülke genelindeki YKS/LGS deneme tarihleri.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NATIONWIDE_EXAMS.map((exam, index) => (
            <NationwideExamCard key={exam.id} exam={exam} index={index} />
          ))}
        </div>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70"
      >
        <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Dershane Etkinlik Takvimi</h2>
        <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">
          &quot;Kampüs Panosu&quot;ndan &quot;Etkinlik&quot; kategorisiyle yayınlanan duyurular burada listelenir.
        </p>

        <div className="relative space-y-4 pl-6">
          <div className="absolute bottom-2 left-[9px] top-2 w-px bg-hairline dark:bg-white/10" />
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06 }}
              className="relative flex gap-3"
            >
              <span className="relative z-10 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-400">
                <FlameIcon className="h-2.5 w-2.5" />
              </span>
              <div className="flex-1 rounded-xl bg-cream-card p-3 dark:bg-white/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-espresso dark:text-cream">{event.title}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-espresso-muted dark:bg-white/10 dark:text-cream/50">
                    {new Date(event.createdAt).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">{event.content}</p>
              </div>
            </motion.div>
          ))}
          {events.length === 0 && (
            <p className="flex items-center gap-1.5 text-xs text-espresso-muted dark:text-cream/40">
              <Megaphone className="h-3.5 w-3.5" /> Henüz etkinlik kategorisinde bir duyuru yayınlanmadı.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
