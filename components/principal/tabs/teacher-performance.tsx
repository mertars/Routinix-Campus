"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, CalendarCheck2, FileCheck2, Rocket } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { MagneticCard } from "@/components/principal/magnetic-card";

type TeacherRow = {
  id: string;
  firstName: string;
  lastName: string;
  subject: string;
  classAverageNet: number | null;
  attendanceSubmissionCount: number;
  homeworkCount: number;
  quizCount: number;
  activityScore: number;
};

export function TeacherPerformanceTab() {
  const { showError } = useToast();
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);

  useEffect(() => {
    fetch("/api/admin/teachers-performance")
      .then((res) => res.json())
      .then((data) => setTeachers(data.teachers ?? []))
      .catch(() => showError("Öğretmen performans verisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Öğretmen Performans & Aktivite Matrisi</h2>
      <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
        Aktiflik Skoru; gerçek bir anket/değerlendirme sistemi olmadığından, yoklama + ödev + quiz sıklığından türetilen şeffaf bir göstergedir.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {teachers.map((teacher, index) => (
          <MagneticCard
            key={teacher.id}
            className="rounded-2xl border border-hairline bg-cream-card p-4 dark:border-white/10 dark:bg-white/5"
          >
            <p className="text-sm font-medium text-espresso dark:text-cream">{teacher.firstName} {teacher.lastName}</p>
            <p className="mb-3 text-xs text-espresso-muted dark:text-cream/40">{teacher.subject}</p>

            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div>
                <TrendingUp className="mx-auto h-3.5 w-3.5 text-brand-600" />
                <p className="mt-1 text-sm font-semibold text-espresso dark:text-cream">{teacher.classAverageNet ?? "—"}</p>
                <p className="text-[9px] text-espresso-muted dark:text-cream/40">Sınıf Net Ort.</p>
              </div>
              <div>
                <CalendarCheck2 className="mx-auto h-3.5 w-3.5 text-brand-600" />
                <p className="mt-1 text-sm font-semibold text-espresso dark:text-cream">{teacher.attendanceSubmissionCount}</p>
                <p className="text-[9px] text-espresso-muted dark:text-cream/40">Yoklama</p>
              </div>
              <div>
                <FileCheck2 className="mx-auto h-3.5 w-3.5 text-brand-600" />
                <p className="mt-1 text-sm font-semibold text-espresso dark:text-cream">{teacher.homeworkCount}</p>
                <p className="text-[9px] text-espresso-muted dark:text-cream/40">Ödev</p>
              </div>
              <div>
                <Rocket className="mx-auto h-3.5 w-3.5 text-brand-600" />
                <p className="mt-1 text-sm font-semibold text-espresso dark:text-cream">{teacher.quizCount}</p>
                <p className="text-[9px] text-espresso-muted dark:text-cream/40">Pop-Quiz</p>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
              <motion.div
                className="h-full rounded-full bg-green-600"
                initial={{ width: 0 }}
                animate={{ width: `${teacher.activityScore}%` }}
                transition={{ type: "spring", stiffness: 70, damping: 15, delay: index * 0.08 }}
              />
            </div>
            <p className="mt-1 text-right text-[10px] text-espresso-muted dark:text-cream/40">Aktiflik Skoru: {teacher.activityScore}/100</p>
          </MagneticCard>
        ))}
        {teachers.length === 0 && <p className="col-span-full text-xs text-espresso-muted dark:text-cream/40">Öğretmen bulunamadı.</p>}
      </div>
    </motion.div>
  );
}
