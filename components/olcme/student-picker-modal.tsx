"use client";

import { useMemo, useState } from "react";
import { Search, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { RosterStudent } from "@/lib/exam-import/types";

// Optik önizlemede eşleşmeyen/belirsiz satırlar için öğrenci seçme
// ekranı (2026-09-05). Kullanıcı haklı: "100 tane öğrenci küçük yerden
// seçilmez" — önceden bu tek satırlık bir <select> idi, 100+ öğrencide
// kullanılamaz hale geliyordu. Şimdi aranabilir bir pop-up.
export function StudentPickerModal({
  isOpen,
  onClose,
  roster,
  currentStudentId,
  rowLabel,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  roster: RosterStudent[];
  currentStudentId: string | null;
  // Optik dosyasındaki ham satırdan gelen isim/TC — admin karşılaştırma
  // yapabilsin diye üstte gösterilir.
  rowLabel?: string;
  onSelect: (studentId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => `${s.firstName} ${s.lastName} ${s.branchName} ${s.studentNumber}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [roster, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Öğrenci Seç" widthClassName="max-w-md">
      {rowLabel && (
        <p className="mb-3 rounded-lg border border-hairline bg-cream-card px-3 py-2 text-[11px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
          Optik dosyasındaki satır: <b className="text-espresso dark:text-cream">{rowLabel}</b>
        </p>
      )}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="İsim, şube ya da öğrenci no ara..."
          className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>
      <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-espresso-muted dark:text-cream/40">Sonuç bulunamadı.</p>
        ) : (
          filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                onSelect(s.id);
                onClose();
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition",
                currentStudentId === s.id ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "hover:bg-cream-card dark:hover:bg-white/5"
              )}
            >
              <span className="min-w-0 truncate text-xs font-medium text-espresso dark:text-cream">
                {s.firstName} {s.lastName}{" "}
                <span className="font-normal text-espresso-muted dark:text-cream/40">
                  · {s.branchName} · No: {s.studentNumber}
                </span>
              </span>
              {currentStudentId === s.id && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
