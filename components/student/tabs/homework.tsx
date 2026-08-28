"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileCheck2, Camera, Paperclip, CheckCircle2, Circle, ShieldCheck, AlertOctagon, Link as LinkIcon, ListChecks, Loader2 } from "lucide-react";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type HomeworkStatus = "NOT_DONE" | "HALF" | "DONE" | "LATE";
type HomeworkEntry = {
  id: string;
  title: string;
  description: string | null;
  linkUrl: string | null;
  checklist: string[];
  targetQuestionCount: number | null;
  dueAt: string | null;
  teacher: { firstName: string; lastName: string };
  submissions: { studentId: string; status: HomeworkStatus }[];
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
  HALF: "Devam Ediyor",
  DONE: "Teslim Edildi",
  LATE: "Geç Teslim",
};

function isOverdue(dueAt: string | null) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

function HomeworkDetailModal({
  item,
  status,
  onClose,
  onSubmit,
}: {
  item: HomeworkEntry | null;
  status: HomeworkStatus;
  onClose: () => void;
  onSubmit: (status: HomeworkStatus) => void;
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;
  const overdue = isOverdue(item.dueAt);

  function handleSubmit() {
    setSubmitting(true);
    setTimeout(() => {
      onSubmit(overdue ? "LATE" : "DONE");
      setSubmitting(false);
    }, 700);
  }

  return (
    <Modal isOpen={!!item} onClose={onClose} title={item.title}>
      <div className="space-y-3">
        <p className="text-sm text-espresso-muted dark:text-cream/50">{item.description}</p>

        {item.checklist.length > 0 && (
          <div className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
              <ListChecks className="h-3.5 w-3.5" /> Yapılacaklar
            </p>
            <div className="space-y-1.5">
              {item.checklist.map((task, i) => (
                <button
                  key={i}
                  onClick={() => setChecked((prev) => ({ ...prev, [i]: !prev[i] }))}
                  className="flex w-full items-center gap-2 text-left text-xs text-espresso dark:text-cream"
                >
                  {checked[i] ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/30" />}
                  <span className={cn(checked[i] && "line-through opacity-60")}>{task}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {item.targetQuestionCount && (
          <p className="text-xs text-espresso-muted dark:text-cream/40">Hedef soru sayısı: {item.targetQuestionCount}</p>
        )}
        {item.linkUrl && (
          <a href={item.linkUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline">
            <LinkIcon className="h-3.5 w-3.5" /> Ek kaynak bağlantısı
          </a>
        )}
        <p className="text-[11px] text-espresso-muted dark:text-cream/40">
          Son teslim: {item.dueAt ? item.dueAt.replace("T", " ").slice(0, 16) : "belirtilmedi"} {overdue && <span className="text-rose-600 dark:text-rose-400">· Süre doldu</span>}
        </p>

        {status === "DONE" || status === "LATE" ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" /> Bu ödevi teslim ettin.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => onSubmit("HALF")}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-hairline text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              Yapıyorum
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-espresso text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {submitting ? "Gönderiliyor..." : "Fotoğrafla Teslim Et"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function HomeworkCard({ item, status, onOpen }: { item: HomeworkEntry; status: HomeworkStatus; onOpen: () => void }) {
  const Icon = STATE_ICON[status];
  return (
    <motion.button
      onClick={onOpen}
      whileHover={{ scale: 1.01 }}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-cream-card p-3.5 text-left dark:bg-white/5"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-espresso dark:text-cream">{item.title}</p>
        <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
          {item.teacher.firstName} {item.teacher.lastName} · {item.dueAt ? item.dueAt.replace("T", " ").slice(0, 16) : "Süresiz"}
        </p>
      </div>
      <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold", STATE_STYLES[status])}>
        <Icon className="h-3 w-3" /> {STATE_LABEL[status]}
      </span>
    </motion.button>
  );
}

export function HomeworkTab() {
  const { studentId, branchId } = useStudentScope();
  const { showError } = useToast();
  const [myHomeworks, setMyHomeworks] = useState<HomeworkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    if (!branchId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/homework?branchId=${encodeURIComponent(branchId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Ödevler yüklenemedi.");
      setMyHomeworks(data.homeworks ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Ödevler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function statusFor(item: HomeworkEntry): HomeworkStatus {
    return item.submissions.find((s) => s.studentId === studentId)?.status ?? "NOT_DONE";
  }

  async function submitStatus(homeworkId: string, status: HomeworkStatus) {
    try {
      const res = await fetch(`/api/homework/${homeworkId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ studentId, status }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Durum güncellenemedi.");
      setMyHomeworks((prev) =>
        prev.map((item) =>
          item.id === homeworkId
            ? { ...item, submissions: [...item.submissions.filter((s) => s.studentId !== studentId), { studentId, status }] }
            : item
        )
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Durum güncellenemedi.");
    } finally {
      setOpenId(null);
    }
  }

  const active = myHomeworks.filter((item) => ["NOT_DONE", "HALF"].includes(statusFor(item)));
  const completed = myHomeworks.filter((item) => statusFor(item) === "DONE");
  const late = myHomeworks.filter((item) => statusFor(item) === "LATE");
  const openItem = myHomeworks.find((item) => item.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <FileCheck2 className="h-4 w-4 text-brand-600" /> Aktif Ödevler ({active.length})
        </h2>
        <div className="space-y-2">
          <AnimatePresence>
            {active.map((item) => (
              <HomeworkCard key={item.id} item={item} status={statusFor(item)} onOpen={() => setOpenId(item.id)} />
            ))}
          </AnimatePresence>
          {!loading && active.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Aktif ödevin yok, harika gidiyorsun!</p>}
          {loading && <p className="text-xs text-espresso-muted dark:text-cream/40">Yükleniyor...</p>}
        </div>
      </motion.div>

      {late.length > 0 && (
        <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-purple-300/40 bg-purple-50/60 p-5 shadow-sm dark:border-purple-500/20 dark:bg-purple-500/5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <AlertOctagon className="h-4 w-4 text-purple-600" /> Geç Teslim Edilenler
          </h2>
          <div className="space-y-2">
            {late.map((item) => (
              <HomeworkCard key={item.id} item={item} status="LATE" onOpen={() => setOpenId(item.id)} />
            ))}
          </div>
        </motion.div>
      )}

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Paperclip className="h-4 w-4 text-brand-600" /> Tamamlananlar ({completed.length})
        </h2>
        <div className="space-y-2">
          {completed.map((item) => (
            <HomeworkCard key={item.id} item={item} status="DONE" onOpen={() => setOpenId(item.id)} />
          ))}
          {completed.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz tamamlanan ödev yok.</p>}
        </div>
      </motion.div>

      <HomeworkDetailModal
        item={openItem}
        status={openItem ? statusFor(openItem) : "NOT_DONE"}
        onClose={() => setOpenId(null)}
        onSubmit={(status) => {
          if (openItem) submitStatus(openItem.id, status);
        }}
      />
    </div>
  );
}
