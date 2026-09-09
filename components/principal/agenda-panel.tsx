"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, RefreshCw, ChevronDown, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalStorageState } from "@/lib/use-local-storage-state";
import { useAgenda } from "@/lib/agenda-store";
import {
  AREA_LABEL,
  DEFAULT_COLLAPSED,
  HORIZON_HINT,
  HORIZON_LABEL,
  HORIZON_ORDER,
  type AgendaHorizon,
  type AgendaItem,
  type AgendaUrgency,
} from "@/lib/agenda-types";

// GÜNDEM — Genel Bakış'ın ilk sorusu: "şu an ne bekliyor?"
//
// Panelde 29 sekme var; çoğu yılda ya da ayda bir açılıyor. Ekran bir
// ÖZELLİK LİSTESİ gibi kurulmuştu, oysa müdürün sorusu "hangi
// özellikler var" değil "ne bekliyor". Gündem sekmeleri kaldırmaz,
// sıralarını değiştirir: başlangıç noktası bekleyen iş, sekmeler varış
// noktası.
//
// TASARIM KURALLARI (hepsi "kafa karıştırmasın" içindir):
//  1. TEK kırılım: zaman ufku. İç içe ikinci bir grup okumayı zorlaştırır;
//     alan bilgisi satırın sağındaki küçük etikette durur.
//  2. Boş ufuk HİÇ çizilmez — "Bu ay: 0" bir bilgi değil, gürültüdür.
//  3. Her madde SAYILABİLİR ve TIKLANABİLİR: sayı olmayan uyarı
//     ("bazı şeyler eksik") ve gidilecek yeri olmayan uyarı yasak.
//  4. İş yoksa panel tek satıra iner ve yoldan çekilir.

const URGENCY_DOT: Record<AgendaUrgency, string> = {
  critical: "bg-red-500",
  attention: "bg-amber-500",
  info: "bg-sky-500",
};

const URGENCY_RING: Record<AgendaUrgency, string> = {
  critical: "hover:border-red-400/60",
  attention: "hover:border-amber-400/60",
  info: "hover:border-sky-400/60",
};

const HORIZON_ACCENT: Record<AgendaHorizon, string> = {
  today: "text-red-600 dark:text-red-400",
  week: "text-amber-600 dark:text-amber-400",
  month: "text-sky-600 dark:text-sky-400",
  // Eksikler bilerek soluk: dikkat çekmesi değil, ULAŞILABİLİR olması gerekiyor.
  gaps: "text-espresso-muted dark:text-cream/45",
};

function AgendaCard({ item, onGo }: { item: AgendaItem; onGo: (item: AgendaItem) => void }) {
  return (
    <button
      onClick={() => onGo(item)}
      className={cn(
        // h-full: aynı satırdaki kartlar farklı uzunlukta metinlerle
        // farklı yükseklikte kalmasın.
        "group flex h-full items-start gap-3 rounded-xl border border-hairline bg-white px-3.5 py-3 text-left transition dark:border-white/10 dark:bg-midnight-card",
        URGENCY_RING[item.urgency]
      )}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", URGENCY_DOT[item.urgency])} />

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-snug text-espresso dark:text-cream">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-espresso-muted dark:text-cream/45">
          {item.detail}
        </p>
        <span className="mt-1.5 inline-block rounded-md bg-cream-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:bg-white/[0.07] dark:text-cream/40">
          {AREA_LABEL[item.area]}
        </span>
      </div>

      <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-espresso-muted transition-transform group-hover:translate-x-0.5 dark:text-cream/30" />
    </button>
  );
}

function HorizonGroup({
  horizon,
  items,
  collapsed,
  onToggle,
  onGo,
}: {
  horizon: AgendaHorizon;
  items: AgendaItem[];
  collapsed: boolean;
  onToggle: () => void;
  onGo: (item: AgendaItem) => void;
}) {
  const critical = items.filter((i) => i.urgency === "critical").length;

  return (
    <section>
      <button
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-espresso-muted transition-transform dark:text-cream/40",
            collapsed && "-rotate-90"
          )}
        />
        <span className={cn("text-[11px] font-bold uppercase tracking-wider", HORIZON_ACCENT[horizon])}>
          {HORIZON_LABEL[horizon]}
        </span>
        <span className="rounded-full bg-cream-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-espresso-muted dark:bg-white/10 dark:text-cream/50">
          {items.length}
        </span>
        {critical > 0 && (
          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
            {critical} acil
          </span>
        )}
        <span className="truncate text-[11px] text-espresso-muted dark:text-cream/35">{HORIZON_HINT[horizon]}</span>
      </button>

      {!collapsed && (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item, i) => (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 6) * 0.03 }}
            >
              <AgendaCard item={item} onGo={onGo} />
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}

export function AgendaPanel({ onGoTab }: { onGoTab: (tab: string) => void }) {
  const router = useRouter();
  const { items, counts, loading, reload } = useAgenda();
  const [collapsed, setCollapsed] = useLocalStorageState<AgendaHorizon[]>("agenda-collapsed", DEFAULT_COLLAPSED);

  if (!items) return null;

  function go(item: AgendaItem) {
    // Ödeme modülüne giden madde ?tab= taşır — müdür 11 sekme arasında
    // aramasın, doğrudan işin yapılacağı ekrana insin.
    if (item.href) router.push(item.href);
    else if (item.tab) onGoTab(item.tab);
  }

  function toggle(horizon: AgendaHorizon) {
    setCollapsed((prev) => (prev.includes(horizon) ? prev.filter((h) => h !== horizon) : [...prev, horizon]));
  }

  // Eksikler "bugün yapılacak iş" değil; özet sayısına katılmaz, yoksa
  // müdür her gün "14 iş var" görüp hiçbirini bitiremez.
  const workCount = items.filter((i) => i.horizon !== "gaps").length;
  const gapCount = items.length - workCount;
  const summary = [
    counts.critical > 0 ? `${counts.critical} acil` : null,
    `${workCount} iş`,
    gapCount > 0 ? `${gapCount} eksik` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (items.length === 0) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-green-500/25 bg-green-500/[0.04] px-4 py-3">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
        <p className="text-sm text-espresso dark:text-cream">
          Gündem boş — yoklamalar girilmiş, vadesi geçen taksit ve bekleyen talep yok.
        </p>
        <button
          onClick={reload}
          aria-label="Yenile"
          className="ml-auto text-espresso-muted transition hover:text-brand-600 dark:text-cream/40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-hairline bg-white/70 p-4 dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <ListChecks className="h-4 w-4 text-brand-600" /> Gündem
          <span className="ml-1 text-[11px] font-normal text-espresso-muted dark:text-cream/40">
            {summary}
          </span>
        </h2>
        <button
          onClick={reload}
          aria-label="Yenile"
          className="text-espresso-muted transition hover:text-brand-600 dark:text-cream/40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-4">
        {HORIZON_ORDER.map((horizon) => {
          const group = items.filter((i) => i.horizon === horizon);
          // Boş ufuk çizilmez — "Bu ay: 0" bilgi değil gürültüdür.
          if (group.length === 0) return null;
          return (
            <HorizonGroup
              key={horizon}
              horizon={horizon}
              items={group}
              collapsed={collapsed.includes(horizon)}
              onToggle={() => toggle(horizon)}
              onGo={go}
            />
          );
        })}
      </div>
    </div>
  );
}
