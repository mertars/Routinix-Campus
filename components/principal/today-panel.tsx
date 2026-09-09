"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, RefreshCw, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Urgency = "critical" | "attention" | "info";
type Task = {
  key: string;
  title: string;
  detail: string;
  count: number;
  urgency: Urgency;
  tab?: string;
  href?: string;
};

const STYLE: Record<Urgency, { dot: string; ring: string; label: string }> = {
  critical: { dot: "bg-red-500", ring: "hover:border-red-400/50", label: "Bugün" },
  attention: { dot: "bg-amber-500", ring: "hover:border-amber-400/50", label: "Bu hafta" },
  info: { dot: "bg-brand-500", ring: "hover:border-brand-400/50", label: "Bilgi" },
};

// "Bugün ne yapmam lazım?" paneli.
//
// Müdür panelinde 19, ödeme panelinde 13 sekme var — toplam 32. Bunların
// çoğu yılda ya da ayda bir açılıyor; günlük iş küçük bir alt küme.
// Ekran özellik listesi gibi kurulmuştu, oysa müdürün sorusu "hangi
// özellikler var" değil "bugün ne bekliyor".
//
// Bu panel sekmeleri KALDIRMAZ, sıralarını değiştirir: artık başlangıç
// noktası bekleyen iş, sekmeler ise varış noktası. İş yoksa panel
// küçülür ve yoldan çekilir — kalıcı bir "yapılacaklar" kutusu
// gürültüdür.
export function TodayPanel({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/today");
      const d = res.ok ? await res.json() : null;
      setTasks(d?.tasks ?? null);
    } catch {
      setTasks(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Sekmeye gidip iş yapıp dönen müdür güncel listeyi görsün.
  useEffect(() => {
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (!tasks) return null;

  function go(task: Task) {
    if (task.href) router.push(task.href);
    else if (task.tab) onGoTab(task.tab);
  }

  if (tasks.length === 0) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/[0.04] px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <p className="text-sm text-espresso dark:text-cream">
          Bekleyen iş yok — yoklamalar girilmiş, vadesi geçen taksit yok.
        </p>
      </div>
    );
  }

  const acil = tasks.filter((t) => t.urgency === "critical").length;

  return (
    <div className="mb-4 rounded-2xl border border-hairline bg-white/70 p-4 dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Sun className="h-4 w-4 text-brand-600" /> Bugün
          <span className="ml-1 text-[11px] font-normal text-espresso-muted dark:text-cream/40">
            {acil > 0 ? `${acil} acil · ${tasks.length} iş` : `${tasks.length} iş`}
          </span>
        </h2>
        <button
          onClick={load}
          aria-label="Yenile"
          className="text-espresso-muted transition hover:text-brand-600 dark:text-cream/40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {tasks.map((task, i) => {
          const style = STYLE[task.urgency];
          return (
            <motion.button
              key={task.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => go(task)}
              className={cn(
                "flex items-center gap-3 rounded-xl border border-hairline bg-white px-3 py-2.5 text-left transition dark:border-white/10 dark:bg-midnight-card",
                style.ring
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", style.dot)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-espresso dark:text-cream">{task.title}</p>
                <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">{task.detail}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/30" />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
