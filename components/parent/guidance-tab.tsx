"use client";

import { useEffect, useState } from "react";
import { MessageSquareText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Note = { id: string; category: string; note: string; authorName: string; createdAt: string };

const CATEGORY_STYLE: Record<string, { label: string; className: string }> = {
  ACADEMIC: { label: "Akademik", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  PSYCHOLOGICAL: { label: "Rehberlik", className: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  DISCIPLINARY: { label: "Davranış", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
};

// Veliyle paylaşılmak üzere işaretlenmiş rehberlik notları.
//
// Sekme, not YOKSA da bir şey söyler: boş liste "sistem bozuk" gibi
// değil, "paylaşılan not yok" diye okunmalı.
export function ParentGuidanceTab({ studentId }: { studentId: string }) {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/parent/guidance/${studentId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setNotes(d?.notes ?? []))
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!notes || notes.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-white p-8 text-center dark:border-white/5 dark:bg-midnight-card/50">
        <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-espresso-muted/40 dark:text-cream/20" />
        <p className="text-sm text-espresso-muted dark:text-cream/40">Sizinle paylaşılan rehberlik notu yok.</p>
        <p className="mt-1 text-[11px] text-espresso-muted/70 dark:text-cream/30">
          Rehberlik birimi bir görüşmeyi sizinle paylaşmayı seçtiğinde burada görünür.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.map((n) => {
        const cat = CATEGORY_STYLE[n.category] ?? CATEGORY_STYLE.ACADEMIC;
        return (
          <div key={n.id} className="rounded-xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cat.className)}>{cat.label}</span>
              <span className="text-[11px] text-espresso-muted dark:text-cream/40">
                {n.authorName} · {new Date(n.createdAt).toLocaleDateString("tr-TR")}
              </span>
            </div>
            <p className="whitespace-pre-line text-xs text-espresso dark:text-cream/80">{n.note}</p>
          </div>
        );
      })}
    </div>
  );
}
