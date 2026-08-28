"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, GraduationCap, Sun, Info, Siren, CalendarDays } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AnnouncementCategory = "GENERAL" | "EXAM" | "HOLIDAY" | "EVENT" | "EMERGENCY";
type AnnouncementEntry = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  createdAt: string;
  isRead: boolean;
};

const CATEGORY_STYLES: Record<AnnouncementCategory, string> = {
  EXAM: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  HOLIDAY: "bg-brand-50 text-brand-700 dark:bg-brand-600/10 dark:text-brand-400",
  GENERAL: "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40",
  EVENT: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  EMERGENCY: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
};

const CATEGORY_ICON: Record<AnnouncementCategory, typeof Bell> = {
  EXAM: GraduationCap,
  HOLIDAY: Sun,
  GENERAL: Info,
  EVENT: CalendarDays,
  EMERGENCY: Siren,
};

const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
  EXAM: "Sınav",
  HOLIDAY: "Tatil/İdari",
  GENERAL: "Genel",
  EVENT: "Etkinlik",
  EMERGENCY: "Acil",
};

const FILTERS: { id: "all" | AnnouncementCategory; label: string }[] = [
  { id: "all", label: "Tümü" },
  { id: "EMERGENCY", label: "Acil" },
  { id: "EXAM", label: "Sınav" },
  { id: "HOLIDAY", label: "Tatil/İdari" },
  { id: "GENERAL", label: "Genel" },
];

export function AnnouncementsTab() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [filter, setFilter] = useState<"all" | AnnouncementCategory>("all");
  const [announcements, setAnnouncements] = useState<AnnouncementEntry[]>([]);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/announcements?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => {
        const items: AnnouncementEntry[] = data.announcements ?? [];
        setAnnouncements(items);
        // Görüntülenen ama henüz okunmamış duyuruları okundu olarak işaretle.
        items.filter((item) => !item.isRead).forEach((item) => {
          fetch(`/api/announcements/${item.id}/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ studentId }),
          }).catch(() => {});
        });
      })
      .catch(() => showError("Duyurular yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const nonEvents = announcements.filter((a) => a.category !== "EVENT");
  const events = announcements.filter((a) => a.category === "EVENT");
  const filtered = nonEvents.filter((a) => filter === "all" || a.category === filter);

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Bell className="h-4 w-4 text-brand-600" /> Duyurular
        </h2>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "min-h-[32px] rounded-full px-3 text-xs font-medium transition",
                filter === f.id ? "bg-espresso text-cream dark:bg-brand-600" : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="space-y-2.5">
          {filtered.map((item, index) => {
            const Icon = CATEGORY_ICON[item.category];
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn("rounded-xl p-3.5", item.isRead ? "bg-cream-card dark:bg-white/5" : "bg-brand-50/70 ring-1 ring-brand-500/30 dark:bg-brand-600/10")}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-espresso dark:text-cream">
                    {!item.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />} {item.title}
                  </p>
                  <span className={cn("shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold", CATEGORY_STYLES[item.category])}>
                    <Icon className="h-3 w-3" /> {CATEGORY_LABEL[item.category]}
                  </span>
                </div>
                <p className="text-xs text-espresso-muted dark:text-cream/50">{item.content}</p>
                <p className="mt-1 text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(item.createdAt).toLocaleString("tr-TR")}</p>
              </motion.div>
            );
          })}
          {filtered.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bu kategoride duyuru yok.</p>}
        </div>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarDays className="h-4 w-4 text-brand-600" /> Yaklaşan Etkinlikler
        </h2>
        <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
          {events.map((event) => (
            <div key={event.id} className="w-52 shrink-0 rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">{new Date(event.createdAt).toLocaleDateString("tr-TR")}</p>
              <p className="mt-1 text-sm font-medium text-espresso dark:text-cream">{event.title}</p>
              <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">{event.content}</p>
            </div>
          ))}
          {events.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Yaklaşan etkinlik yok.</p>}
        </div>
      </motion.div>
    </div>
  );
}
