"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, FileText, Database, ImageIcon } from "lucide-react";
import { INITIAL_BRANCHES } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { TeacherSchedulePrintModal } from "@/components/teacher/teacher-schedule-print-modal";
import { WeeklyGrid, type WeeklyGridCell } from "@/components/teacher/weekly-grid";

type BankQuestion = { id: string; imageLabel: string; answer: string; addedAt: string };
type ApprovedAppointment = { day: string; slot: string; student: { firstName: string; lastName: string } };

type DutySlot = { day: string; slot: string; label: string };

export function WeeklyScheduleTab() {
  const { teacherName, staffRecord, subject, mySchedule } = useTeacherScope();
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [myQuizBank, setMyQuizBank] = useState<BankQuestion[]>([]);
  const [myEtutSlots, setMyEtutSlots] = useState<ApprovedAppointment[]>([]);
  const [myDutySlots, setMyDutySlots] = useState<DutySlot[]>([]);

  useEffect(() => {
    fetch(`/api/quizzes/bank?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyQuizBank(data.questions ?? []))
      .catch(() => {
        // sessiz — banka boş görünür
      });
    fetch(`/api/appointments?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyEtutSlots((data.appointments ?? []).filter((a: { status: string }) => a.status === "APPROVED")))
      .catch(() => {
        // sessiz — etüt hücreleri boş görünür
      });
    fetch(`/api/teacher-duty-slots?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyDutySlots(data.slots ?? []))
      .catch(() => {
        // sessiz — nöbet hücreleri boş görünür
      });
  }, [staffRecord.id]);

  const scheduleWithBranch = mySchedule.map((row) => ({
    ...row,
    branchName: INITIAL_BRANCHES.find((b) => b.id === row.branchId)?.name ?? row.branchId,
  }));

  const CELL_STYLES = {
    ders: "border-brand-600/40 bg-brand-50 dark:border-brand-600/20 dark:bg-brand-600/10",
    etut: "border-green-500/40 bg-green-50 dark:border-green-500/20 dark:bg-green-500/10",
    nobet: "border-purple-400/40 bg-purple-50 dark:border-purple-400/20 dark:bg-purple-500/10",
  };

  function getCell(day: string, slot: string): WeeklyGridCell {
    const lesson = scheduleWithBranch.find((row) => row.day === day && row.slot === slot);
    if (lesson) return { label: lesson.branchName, tone: CELL_STYLES.ders };
    const etut = myEtutSlots.find((row) => row.day === day && row.slot === slot);
    if (etut) return { label: `${etut.student.firstName} ${etut.student.lastName}`, tone: CELL_STYLES.etut };
    const duty = myDutySlots.find((row) => row.day === day && row.slot === slot);
    if (duty) return { label: duty.label, tone: CELL_STYLES.nobet };
    return null;
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <CalendarDays className="h-4 w-4 text-brand-600" /> Haftalık Ders Programım
          </h2>
          <button
            onClick={() => setIsPrintOpen(true)}
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <FileText className="h-3.5 w-3.5" /> A4 / PDF İndir
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-[10px] text-espresso-muted dark:text-cream/40">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Ders</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Etüt</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-purple-400" /> Nöbet</span>
        </div>

        <WeeklyGrid getCell={getCell} />
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Database className="h-4 w-4 text-brand-600" /> Pop-Quiz Soru Bankası & Materyal Deposu
        </h2>
        <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">
          {subject} · Bu sorular Pop-Quiz Fırlatıcı&apos;nın &quot;Soru Bankasından Ekle&quot; bölümünden doğrudan kullanılabilir.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {myQuizBank.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04 }}
              className="flex items-center gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
            >
              <ImageIcon className="h-4 w-4 shrink-0 text-brand-600" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-espresso dark:text-cream">{item.imageLabel}</p>
                <p className="text-[10px] text-espresso-muted dark:text-cream/40">Cevap: {item.answer} · {new Date(item.addedAt).toLocaleDateString("tr-TR")}</p>
              </div>
            </motion.div>
          ))}
          {myQuizBank.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Soru bankası boş.</p>}
        </div>
      </motion.div>

      <TeacherSchedulePrintModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        teacherName={teacherName}
        subject={subject}
        schedule={scheduleWithBranch}
      />
    </div>
  );
}
