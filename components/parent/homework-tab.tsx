"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  createdAt: string;
  teacherName: string;
  subject: string;
  status: string;
  updatedAt: string | null;
};
type Payload = { homeworks: Row[]; total: number; done: number; overdue: number; successRate: number | null };

const STATUS_STYLE: Record<string, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  DONE: { label: "Yapıldı", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400", Icon: CheckCircle2 },
  LATE: { label: "Geç yapıldı", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", Icon: Clock },
  NOT_DONE: { label: "Yapılmadı", className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", Icon: AlertTriangle },
};

export function ParentHomeworkTab({ studentId }: { studentId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/parent/homework/${studentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <p className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-espresso-muted dark:border-white/5 dark:bg-midnight-card/50 dark:text-cream/40">
        Henüz ödev kaydı yok.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
        <div>
          <p className="text-xs text-espresso-muted dark:text-cream/40">Yapılan</p>
          <p className="text-2xl font-bold text-espresso dark:text-cream">
            {data.done}/{data.total}
          </p>
        </div>
        <div>
          <p className="text-xs text-espresso-muted dark:text-cream/40">Başarı</p>
          {/* Ödev yoksa "%0" değil "—": sıfır ödevi başarısızlık gibi
              göstermek veliyi yanıltır. */}
          <p className="text-2xl font-bold text-espresso dark:text-cream">
            {data.successRate === null ? "—" : `%${data.successRate}`}
          </p>
        </div>
        {data.overdue > 0 && (
          <div>
            <p className="text-xs text-espresso-muted dark:text-cream/40">Süresi geçen</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{data.overdue}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {data.homeworks.map((h) => {
          const style = STATUS_STYLE[h.status] ?? STATUS_STYLE.NOT_DONE;
          const overdue = h.status !== "DONE" && h.dueAt !== null && new Date(h.dueAt) < new Date();
          return (
            <div
              key={h.id}
              className={cn(
                "rounded-xl border bg-white p-3 dark:bg-midnight-card/50",
                overdue ? "border-red-500/40" : "border-hairline dark:border-white/5"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-espresso dark:text-cream">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    {h.title}
                  </p>
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                    {h.subject} · {h.teacherName}
                    {h.dueAt && ` · son teslim ${new Date(h.dueAt).toLocaleDateString("tr-TR")}`}
                  </p>
                  {h.description && (
                    <p className="mt-1 text-xs text-espresso-muted dark:text-cream/50">{h.description}</p>
                  )}
                </div>
                <span className={cn("flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium", style.className)}>
                  <style.Icon className="h-3 w-3" />
                  {style.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
