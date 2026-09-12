"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type PickableStudent = { id: string; firstName: string; lastName: string; branchName: string };

// Kullanıcı bulgusu: "40 50 öğrencinin dersine giren hoca için" düz bir
// `<select>` (bkz. eski gap-closing.tsx/risk-referral.tsx) gerçekten
// kullanışsız — isme/şubeye göre ARAMA olmadan tek tek kaydırmak
// gerekiyordu. Bu, xray-results-panel.tsx'teki arama kutusu + filtrelenmiş
// tıklanabilir liste desenini genel bir bileşene taşır (Eksik Kapatma VE
// Rehberlik Sevk & Risk Alarmı'nın manuel sevk bölümü İKİSİ DE kullanır).
export function StudentSearchPicker({
  students,
  selectedId,
  onSelect,
  placeholder = "İsim veya şube ara...",
}: {
  students: PickableStudent[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const selected = students.find((s) => s.id === selectedId);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;
    return students.filter((s) => `${s.firstName} ${s.lastName} ${s.branchName}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [students, query]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={selected ? `${selected.firstName} ${selected.lastName} — ${placeholder}` : placeholder}
          className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>
      {query && (
        <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-hairline bg-white p-1 dark:border-white/10 dark:bg-midnight">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s.id);
                setQuery("");
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-cream-card dark:hover:bg-white/5",
                s.id === selectedId && "bg-brand-50 dark:bg-brand-600/10"
              )}
            >
              <span className="truncate text-espresso dark:text-cream">
                {s.firstName} {s.lastName} <span className="text-espresso-muted dark:text-cream/40">— {s.branchName}</span>
              </span>
              {s.id === selectedId && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2.5 py-1.5 text-xs text-espresso-muted dark:text-cream/40">Sonuç yok.</p>}
        </div>
      )}
    </div>
  );
}
