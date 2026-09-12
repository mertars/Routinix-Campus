"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickableHomework = { id: string; title: string; dueAt: string | null };

// Kullanıcı bulgusu: "50 tane ödev olunca aradan seçmek çok zor olur" — düz
// bir `<select>` (Ödev Kontrol Matrisi'nin ödev seçici) çok sayıda ödevle
// kullanışsız hale gelir. student-search-picker.tsx'teki AYNI arama kutusu +
// filtrelenmiş tıklanabilir liste deseni burada ödev başlığı için tekrarlanır.
export function HomeworkSearchPicker({
  homeworks,
  selectedId,
  onSelect,
  placeholder = "Ödev başlığı ara...",
}: {
  homeworks: PickableHomework[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = homeworks.find((h) => h.id === selectedId);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return homeworks;
    return homeworks.filter((h) => h.title.toLocaleLowerCase("tr-TR").includes(q));
  }, [homeworks, query]);

  if (homeworks.length === 0) {
    return (
      <span className="flex min-h-[44px] items-center rounded-lg border border-hairline bg-white px-3 text-sm text-espresso-muted dark:border-white/10 dark:bg-midnight-card dark:text-cream/40">
        Atanan ödev yok
      </span>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={selected ? selected.title : placeholder}
          className="min-h-[44px] w-full min-w-[220px] rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      </div>
      {query && (
        <div className="absolute z-20 mt-1 max-h-56 w-full min-w-[260px] space-y-0.5 overflow-y-auto rounded-lg border border-hairline bg-white p-1 shadow-lg dark:border-white/10 dark:bg-midnight">
          {filtered.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                onSelect(h.id);
                setQuery("");
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-cream-card dark:hover:bg-white/5",
                h.id === selectedId && "bg-brand-50 dark:bg-brand-600/10"
              )}
            >
              <span className="min-w-0 flex-1 truncate text-espresso dark:text-cream">
                {h.title}
                {h.dueAt && (
                  <span className="text-espresso-muted dark:text-cream/40"> — {h.dueAt.replace("T", " ").slice(0, 16)}</span>
                )}
              </span>
              {h.id === selectedId && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2.5 py-1.5 text-xs text-espresso-muted dark:text-cream/40">Sonuç yok.</p>}
        </div>
      )}
    </div>
  );
}
