"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, CheckCircle2, Loader2, Puzzle, Video } from "lucide-react";
import { cn } from "@/lib/utils";

// ETÜT & GÖREVLER — velinin "çocuğuma ne atandı, yaptı mı?" ekranı.
//
// ⚠️ NEDEN VAR (2026-09-15 denetimi): veliye etüt kararı, video atama ve
// kazanım görevi bildirimleri gidiyordu ama veli panelinde bunların hiçbir
// karşılığı YOKTU — bildirime tıklayan veli boş bir panele düşüyordu.
// Bildirim gönderip gidecek yer vermemek, bildirim sistemine güveni bitirir.

type Appointment = {
  id: string;
  day: string;
  slot: string;
  topic: string;
  status: string;
  teacherName: string;
  subject: string;
};
type Task = { id: string; topic: string; description: string; assignedAt: string };
type AssignedVideo = { id: string; title: string; subject: string; assignedAt: string; watchedAt: string | null };

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Onay bekliyor", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  APPROVED: { label: "Onaylandı", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  REJECTED: { label: "Reddedildi", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  COMPLETED: { label: "Yapıldı", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  NO_SHOW: { label: "Gidilmedi", className: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

function Card({ icon: Icon, title, count, children }: { icon: typeof Video; title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Icon className="h-4 w-4 text-brand-600" /> {title}
        <span className="ml-auto rounded-full bg-cream-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-espresso-muted dark:bg-white/10 dark:text-cream/50">
          {count}
        </span>
      </h3>
      {children}
    </section>
  );
}

export function ParentActivityTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<{ appointments: Appointment[]; tasks: Task[]; videos: AssignedVideo[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setData(null);
    setFailed(false);
    fetch(`/api/parent/activity/${studentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setFailed(true));
  }, [studentId]);

  if (failed) {
    return (
      <p className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-espresso-muted dark:border-white/5 dark:bg-midnight-card/50 dark:text-cream/40">
        Bilgiler yüklenemedi.
      </p>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const empty = data.appointments.length === 0 && data.tasks.length === 0 && data.videos.length === 0;
  if (empty) {
    return (
      <p className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-espresso-muted dark:border-white/5 dark:bg-midnight-card/50 dark:text-cream/40">
        Henüz atanmış etüt, video veya kazanım görevi yok.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {data.appointments.length > 0 && (
        <Card icon={CalendarClock} title="Etüt randevuları" count={data.appointments.length}>
          <div className="space-y-2">
            {data.appointments.map((a, i) => {
              const s = STATUS_STYLE[a.status] ?? { label: a.status, className: "bg-cream-card" };
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.03 }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-espresso dark:text-cream">
                      {a.day} · {a.slot}
                    </p>
                    <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
                      {a.teacherName} ({a.subject}) · {a.topic}
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", s.className)}>
                    {s.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </Card>
      )}

      {data.tasks.length > 0 && (
        <Card icon={Puzzle} title="Kazanım görevleri" count={data.tasks.length}>
          <div className="space-y-2">
            {data.tasks.map((t) => (
              <div key={t.id} className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
                <p className="text-sm font-medium text-espresso dark:text-cream">{t.topic}</p>
                <p className="text-[11.5px] text-espresso-muted dark:text-cream/45">{t.description}</p>
                <p className="mt-0.5 text-[10px] text-espresso-muted/80 dark:text-cream/35">
                  {new Date(t.assignedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.videos.length > 0 && (
        <Card icon={Video} title="Atanan videolar" count={data.videos.length}>
          <div className="space-y-2">
            {data.videos.map((v) => (
              <div
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso dark:text-cream">{v.title}</p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">{v.subject}</p>
                </div>
                {v.watchedAt ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" /> İzledi
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                    İzlemedi
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
