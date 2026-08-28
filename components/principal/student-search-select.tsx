"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type StudentOption = { id: string; firstName: string; lastName: string; branchName: string };

// Öğrenci seçici — kurum onlarca/yüzlerce öğrenciye ulaştığında düz bir
// <select> içinde ismi arayarak bulmak pratik değil. Rehberlik Programı
// (guidance-program.tsx) VE Mezun Ekle (alumni-network.tsx) ekranları AYNI
// bileşeni paylaşır — roster her ikisinde de zaten tek seferde tam olarak
// client'a çekildiği için arama sunucuya gitmeden burada, yerel olarak yapılır.
export function StudentSearchSelect({
  students,
  selectedStudentId,
  onSelect,
}: {
  students: StudentOption[];
  selectedStudentId: string;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selected = students.find((row) => row.id === selectedStudentId);
  const normalizedQuery = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = normalizedQuery
    ? students.filter((row) => `${row.firstName} ${row.lastName} ${row.branchName}`.toLocaleLowerCase("tr-TR").includes(normalizedQuery))
    : students;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
        <input
          value={open ? query : selected ? `${selected.firstName} ${selected.lastName} — ${selected.branchName}` : ""}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder="Öğrenci ara (ad veya şube)..."
          className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        />
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-hairline bg-white p-1 shadow-xl dark:border-white/10 dark:bg-midnight-card"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-espresso-muted dark:text-cream/40">Sonuç bulunamadı.</p>
            ) : (
              filtered.map((row) => (
                <button
                  key={row.id}
                  onClick={() => {
                    onSelect(row.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-cream-card dark:hover:bg-white/5",
                    row.id === selectedStudentId && "bg-brand-50 dark:bg-brand-600/10"
                  )}
                >
                  <span className="font-medium text-espresso dark:text-cream">
                    {row.firstName} {row.lastName}
                  </span>
                  <span className="text-espresso-muted dark:text-cream/40">{row.branchName}</span>
                </button>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
