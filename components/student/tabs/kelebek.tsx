"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Ticket, MapPin, Armchair, CalendarClock } from "lucide-react";
import { NATIONWIDE_EXAMS } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";

type Assignment = { examName: string; examDate: string; hall: string; seatNumber: number; rowNum: number; colNum: number };

export function KelebekTab() {
  const { studentId, studentName, branchName, track } = useStudentScope();
  const { showError } = useToast();
  const [assignment, setAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/exam-seating?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setAssignment(data.assignment ?? null))
      .catch(() => showError("Sınav koltuk bilgisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const upcomingExam = NATIONWIDE_EXAMS.find((e) => (track === "lgs" ? e.scope === "LGS" : e.scope === "YKS")) ?? NATIONWIDE_EXAMS[0];

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="relative overflow-hidden rounded-3xl bg-espresso p-6 text-cream shadow-xl dark:bg-brand-600/90"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-cream/60">
            <Ticket className="h-3.5 w-3.5" /> Dijital Sınav Giriş Kartı
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10" aria-hidden>
            <div className="grid h-6 w-6 grid-cols-3 gap-0.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className={i % 2 === 0 ? "bg-white/80" : "bg-transparent"} />
              ))}
            </div>
          </div>
        </div>

        <p className="text-2xl font-bold">{studentName}</p>
        <p className="mb-4 text-xs text-cream/60">{branchName}</p>

        <div className="mb-4 rounded-2xl bg-white/10 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-cream/60">
            <CalendarClock className="h-3 w-3" /> Yaklaşan Deneme
          </p>
          <p className="mt-1 text-sm font-semibold">{upcomingExam?.name ?? "Deneme takvimi henüz açıklanmadı"}</p>
          {upcomingExam && <p className="text-[11px] text-cream/60">{upcomingExam.organizer} · {upcomingExam.date}</p>}
        </div>

        {assignment ? (
          <>
            <p className="mb-2 text-[10px] text-cream/60">{assignment.examName}</p>
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-xl bg-white/10 p-3">
                <MapPin className="mx-auto mb-1 h-3.5 w-3.5 text-cream/60" />
                <p className="text-[9px] text-cream/50">Salon</p>
                <p className="text-xs font-semibold">{assignment.hall}</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <Armchair className="mx-auto mb-1 h-3.5 w-3.5 text-cream/60" />
                <p className="text-[9px] text-cream/50">Sıra / Sütun</p>
                <p className="text-xs font-semibold">{assignment.rowNum}. Sıra, {assignment.colNum}. Sütun</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3">
                <Ticket className="mx-auto mb-1 h-3.5 w-3.5 text-cream/60" />
                <p className="text-[9px] text-cream/50">Koltuk No</p>
                <p className="text-xs font-semibold">#{assignment.seatNumber}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-white/10 p-4 text-center text-xs text-cream/70">
            Henüz sana ait bir kelebek oturma ataması yapılmadı.
          </div>
        )}
      </motion.div>

      <p className="text-center text-[10px] text-espresso-muted/70 dark:text-cream/30">
        Salon/koltuk ataması kurum içi kelebek sistemine göre otomatik oluşturulur.
      </p>
    </div>
  );
}
