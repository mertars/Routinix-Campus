"use client";

import { Search } from "lucide-react";
import { openCommandPalette } from "@/lib/command-palette-store";
import { cn } from "@/lib/utils";

// Komut paletini açan tuş — BEŞ modülün üst çubuğunda aynı bileşen.
//
// Arama eskiden yalnızca ERP'de vardı; diğer dört panelde müdürün
// aradığı şeye ulaşmasının hiçbir yolu yoktu. Kısayolun kendisi (⌘K)
// paletin içinde global olarak kurulu (bkz. components/shared/
// command-palette.tsx) — bu tuş yalnızca görünür karşılığı.
export function CommandPaletteTrigger({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <button
        onClick={openCommandPalette}
        aria-label="Ara"
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5",
          className
        )}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={openCommandPalette}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-hairline bg-white/70 px-3 py-1.5 text-xs text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream/40 dark:hover:bg-white/5",
        className
      )}
    >
      <Search className="h-3.5 w-3.5" />
      <span>Ara</span>
      <kbd className="rounded border border-hairline px-1 text-[10px] dark:border-white/20">⌘K</kbd>
    </button>
  );
}
