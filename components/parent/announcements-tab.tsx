"use client";

import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  content: string;
  category: string;
  authorName: string;
  createdAt: string;
  isRead: boolean;
};

const CATEGORY_STYLE: Record<string, { label: string; className: string }> = {
  GENERAL: { label: "Genel", className: "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/50" },
  EXAM: { label: "Sınav", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  HOLIDAY: { label: "Tatil", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  EVENT: { label: "Etkinlik", className: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  EMERGENCY: { label: "Acil", className: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" },
};

// Kurum duyuruları veliye ULAŞMIYORDU: uç (/api/announcements?studentId=)
// veliye açıktı ama panelde onu okuyan hiçbir ekran yoktu. Müdürün
// "tüm okula" yayınladığı duyuru yalnızca öğrenci panelinde görünüyordu.
export function ParentAnnouncementsTab({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/announcements?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => setItems(d?.announcements ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <p className="rounded-2xl border border-hairline bg-white p-8 text-center text-sm text-espresso-muted dark:border-white/5 dark:bg-midnight-card/50 dark:text-cream/40">
        Henüz duyuru yok.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const cat = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.GENERAL;
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-xl border bg-white p-4 dark:bg-midnight-card/50",
              item.category === "EMERGENCY" ? "border-red-500/40" : "border-hairline dark:border-white/5"
            )}
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-brand-600" />
              <span className="text-sm font-semibold text-espresso dark:text-cream">{item.title}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", cat.className)}>{cat.label}</span>
            </div>
            {/* Duyuru metni satır sonlarını korur — şablonlar çok satırlı. */}
            <p className="whitespace-pre-line text-xs text-espresso-muted dark:text-cream/60">{item.content}</p>
            <p className="mt-2 text-[10px] text-espresso-muted/70 dark:text-cream/30">
              {item.authorName} · {new Date(item.createdAt).toLocaleDateString("tr-TR")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
