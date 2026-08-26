"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Radio, Clock, BookOpen, ChevronDown, CheckCircle2, Circle, FileText, Download, Check } from "lucide-react";
import { CURRICULUM_TREE, type ScheduleAssignment, type ScheduleDay, type ScheduleSlot } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useCurrentLesson } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { WeeklyGrid, type WeeklyGridCell } from "@/components/teacher/weekly-grid";
import { cn } from "@/lib/utils";

type Material = { id: string; title: string; fileUrl: string; fileType: string; sizeLabel: string; createdAt: string };

function MaterialRow({ material }: { material: Material }) {
  const [state, setState] = useState<"idle" | "done">("idle");

  function download() {
    const link = document.createElement("a");
    link.href = material.fileUrl;
    link.download = material.title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setState("done");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-cream-card p-3 dark:bg-white/5">
      <div className="flex min-w-0 items-center gap-2.5">
        <FileText className="h-4 w-4 shrink-0 text-brand-600" />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-espresso dark:text-cream">{material.title}</p>
          <p className="text-[10px] text-espresso-muted dark:text-cream/40">{material.fileType.toUpperCase()} · {material.sizeLabel} · {new Date(material.createdAt).toLocaleDateString("tr-TR")}</p>
        </div>
      </div>
      <button
        onClick={download}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition",
          state === "done" ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-espresso text-cream dark:bg-brand-600"
        )}
      >
        {state === "done" ? <Check className="h-3 w-3" /> : <Download className="h-3 w-3" />}
        {state === "idle" ? "İndir" : "İndirildi"}
      </button>
    </div>
  );
}

export function WeeklyScheduleTab() {
  const { branchId } = useStudentScope();
  const { showError } = useToast();
  const [mySchedule, setMySchedule] = useState<ScheduleAssignment[]>([]);
  const [coveredMap, setCoveredMap] = useState<Record<string, boolean>>({});
  const [materials, setMaterials] = useState<Material[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(Object.keys(CURRICULUM_TREE)[0] ?? null);

  const lesson = useCurrentLesson(mySchedule);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/lesson-slots?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => {
        setMySchedule(
          (data.slots ?? []).map((s: { id: string; branchId: string; day: string; slot: string; subject: string; teacherName: string }) => ({
            id: s.id,
            branchId: s.branchId,
            day: s.day as ScheduleDay,
            slot: s.slot as ScheduleSlot,
            teacherName: s.teacherName,
            subject: s.subject,
          }))
        );
      })
      .catch(() => showError("Ders programı yüklenemedi."));

    fetch(`/api/curriculum-progress?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => {
        const map: Record<string, boolean> = {};
        Object.values(CURRICULUM_TREE).forEach((topics) => topics.forEach((topic) => topic.subtopics.forEach((sub) => (map[sub.id] = sub.covered))));
        (data.progress ?? []).forEach((row: { subtopicId: string; covered: boolean }) => (map[row.subtopicId] = row.covered));
        setCoveredMap(map);
      })
      .catch(() => showError("Müfredat durumu yüklenemedi."));

    fetch(`/api/materials?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => setMaterials(data.materials ?? []))
      .catch(() => showError("Ders notları yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function getCell(day: (typeof mySchedule)[number]["day"], slot: (typeof mySchedule)[number]["slot"]): WeeklyGridCell {
    const row = mySchedule.find((item) => item.day === day && item.slot === slot);
    if (!row) return null;
    return { label: `${row.subject} · ${row.teacherName}`, tone: "border-brand-500/40 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-600/10" };
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className={cn(
          "flex items-center gap-2 rounded-2xl p-4 text-sm font-semibold",
          lesson.isLive ? "bg-green-600 text-white shadow-sm" : "border border-hairline bg-white/70 text-espresso-muted backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30 dark:text-cream/40"
        )}
      >
        {lesson.isLive ? (
          <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <Radio className="h-4 w-4" />
          </motion.span>
        ) : (
          <Clock className="h-4 w-4" />
        )}
        {lesson.isLive
          ? `Şu An Canlı: ${lesson.subject} (${lesson.slot})`
          : lesson.branchName
            ? `Sıradaki Ders: ${lesson.subject} · ${lesson.day} ${lesson.slot}`
            : "Sıradaki ders bilgisi yok"}
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <CalendarDays className="h-4 w-4 text-brand-600" /> Haftalık Ders Programı
        </h2>
        <WeeklyGrid getCell={getCell} />
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <BookOpen className="h-4 w-4 text-brand-600" /> Müfredat Durumu
        </h2>
        <div className="space-y-2">
          {Object.entries(CURRICULUM_TREE).map(([subject, topics]) => {
            const isExpanded = expandedSubject === subject;
            const coveredCount = topics.reduce((sum, t) => sum + t.subtopics.filter((s) => coveredMap[s.id]).length, 0);
            const totalCount = topics.reduce((sum, t) => sum + t.subtopics.length, 0);
            return (
              <div key={subject} className="overflow-hidden rounded-2xl bg-cream-card dark:bg-white/5">
                <button onClick={() => setExpandedSubject(isExpanded ? null : subject)} className="flex min-h-[48px] w-full items-center justify-between px-3.5 text-left">
                  <span className="text-sm font-medium text-espresso dark:text-cream">{subject}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] text-espresso-muted dark:text-cream/40">{coveredCount}/{totalCount} işlendi</span>
                    <ChevronDown className={cn("h-4 w-4 text-espresso-muted transition-transform dark:text-cream/40", isExpanded && "rotate-180")} />
                  </span>
                </button>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="space-y-2 px-3.5 pb-3.5">
                        {topics.map((topic) => (
                          <div key={topic.id}>
                            <p className="mb-1 text-[11px] font-semibold text-espresso-muted dark:text-cream/40">{topic.name}</p>
                            <div className="space-y-1">
                              {topic.subtopics.map((sub) => (
                                <div key={sub.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 dark:bg-midnight-card">
                                  <span className="flex items-center gap-1.5 text-xs text-espresso dark:text-cream">
                                    {coveredMap[sub.id] ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Circle className="h-3.5 w-3.5 text-espresso-muted/40 dark:text-cream/20" />}
                                    {sub.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <FileText className="h-4 w-4 text-brand-600" /> Ders Notları
        </h2>
        <div className="space-y-2">
          {materials.map((m) => (
            <MaterialRow key={m.id} material={m} />
          ))}
          {materials.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz paylaşılan ders notu yok.</p>}
        </div>
      </motion.div>
    </div>
  );
}
