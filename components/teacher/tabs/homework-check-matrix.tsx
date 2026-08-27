"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Circle, ShieldCheck, AlertOctagon, CalendarClock, Save, CheckCheck, Loader2 } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type HomeworkStatus = "NOT_DONE" | "HALF" | "DONE" | "LATE";
type RosterStudent = { id: string; firstName: string; lastName: string };
type HomeworkEntry = {
  id: string;
  title: string;
  branchIds: string[];
  dueAt: string | null;
  submissions: { studentId: string; status: HomeworkStatus }[];
};

const NEXT_STATE: Record<HomeworkStatus, HomeworkStatus> = {
  NOT_DONE: "HALF",
  HALF: "DONE",
  DONE: "LATE",
  LATE: "NOT_DONE",
};

const STATE_STYLES: Record<HomeworkStatus, string> = {
  NOT_DONE: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300",
  HALF: "bg-brand-50 text-brand-700 dark:bg-brand-600/10 dark:text-brand-400",
  DONE: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  LATE: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
};

const STATE_ICON: Record<HomeworkStatus, typeof Circle> = {
  NOT_DONE: Circle,
  HALF: ShieldCheck,
  DONE: CheckCircle2,
  LATE: AlertOctagon,
};

const STATE_LABEL: Record<HomeworkStatus, string> = {
  NOT_DONE: "Yapılmadı",
  HALF: "Yarım",
  DONE: "Yapıldı",
  LATE: "Geç Teslim Etti",
};

export function HomeworkCheckMatrixTab() {
  const { staffRecord, assignedBranches } = useTeacherScope();
  const { showError, showSuccess } = useToast();

  const [myAssignments, setMyAssignments] = useState<HomeworkEntry[]>([]);
  const [branchId, setBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [homeworkId, setHomeworkId] = useState("");
  const [draft, setDraft] = useState<Record<string, HomeworkStatus>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/homework?teacherId=${encodeURIComponent(staffRecord.id)}`)
      .then((res) => res.json())
      .then((data) => setMyAssignments(data.homeworks ?? []))
      .catch(() => showError("Ödevler yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  useEffect(() => {
    if (!branchId) return;
    fetch(`/api/students?branchId=${encodeURIComponent(branchId)}`)
      .then((res) => res.json())
      .then((data) => setRoster(data.students ?? []))
      .catch(() => showError("Sınıf listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const branchAssignments = useMemo(() => myAssignments.filter((item) => item.branchIds.includes(branchId)), [myAssignments, branchId]);

  useEffect(() => {
    if (!branchAssignments.find((item) => item.id === homeworkId)) {
      setHomeworkId(branchAssignments[0]?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, myAssignments.length]);

  const homework = branchAssignments.find((item) => item.id === homeworkId);

  function cycle(studentId: string) {
    if (!homework) return;
    const current = draft[studentId] ?? homework.submissions.find((s) => s.studentId === studentId)?.status ?? "NOT_DONE";
    setDraft((prev) => ({ ...prev, [studentId]: NEXT_STATE[current] }));
  }

  async function handleSave() {
    if (!homework || Object.keys(draft).length === 0) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/homework/${homework.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: Object.entries(draft).map(([studentId, status]) => ({ studentId, status })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");

      setMyAssignments((prev) =>
        prev.map((item) =>
          item.id === homework.id
            ? {
                ...item,
                submissions: [
                  ...item.submissions.filter((s) => !(s.studentId in draft)),
                  ...Object.entries(draft).map(([studentId, status]) => ({ studentId, status })),
                ],
              }
            : item
        )
      );
      setDraft({});
      setSaved(true);
      showSuccess("Yönetici paneline senkronize edildi.");
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold uppercase tracking-tight text-espresso dark:text-cream">Ödev Kontrol Matrisi</h1>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="min-h-[44px] rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {assignedBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            value={homeworkId}
            onChange={(event) => setHomeworkId(event.target.value)}
            className="min-h-[44px] rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            {branchAssignments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
            {branchAssignments.length === 0 && <option value="">Atanan ödev yok</option>}
          </select>
        </div>
        {homework?.dueAt && (
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-600/15 dark:text-brand-300">
            <CalendarClock className="h-3.5 w-3.5" /> Son Teslim: {homework.dueAt.replace("T", " ").slice(0, 16)}
          </span>
        )}
      </div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="overflow-x-auto rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        {homework ? (
          <>
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {roster.map((student, index) => {
                const status = draft[student.id] ?? homework.submissions.find((s) => s.studentId === student.id)?.status ?? "NOT_DONE";
                const Icon = STATE_ICON[status];
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    className="rounded-2xl bg-cream-card p-3 dark:bg-white/5"
                  >
                    <p className="mb-2 truncate text-sm font-medium text-espresso dark:text-cream">{student.firstName} {student.lastName}</p>
                    <button
                      onClick={() => cycle(student.id)}
                      className={cn(
                        "flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition active:scale-[0.98]",
                        STATE_STYLES[status]
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" /> {STATE_LABEL[status]}
                    </button>
                  </motion.div>
                );
              })}
            </div>
            <p className="mb-3 text-center text-[10px] text-espresso-muted dark:text-cream/40">Duruma dokunarak değiştirin</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-3 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCheck className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? "Kaydediliyor..." : saved ? "Yönetici Paneline Senkronize Edildi" : "Kaydet & Güncelle"}
            </button>
          </>
        ) : (
          <p className="text-xs text-espresso-muted dark:text-cream/40">
            Bu sınıf için henüz ödev atanmadı. Önce &quot;Ödev Atama&quot; modülünden bir ödev gönderin.
          </p>
        )}
      </motion.div>
    </div>
  );
}
