"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, GraduationCap, UserCog2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchHit = {
  type: "STUDENT" | "TEACHER" | "PARENT";
  id: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  openDebt?: number;
};

const ICONS = { STUDENT: GraduationCap, TEACHER: UserCog2, PARENT: Users };
const TYPE_LABEL = { STUDENT: "Öğrenci", TEACHER: "Öğretmen", PARENT: "Veli" };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

// Kurum genelinde tek kutudan arama.
//
// Müdür bir kişiyi bulmak için önce hangi ekranda olduğunu hatırlamak
// zorundaydı. Burada isim, öğrenci numarası, T.C. veya TELEFON yazması
// yeterli — veli aradığında elindeki tek bilgi çoğu zaman numaradır.
export function GlobalSearchModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setHits(res.ok ? (data.hits ?? []) : []);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Her tuşta istek atmamak için gecikme — 100+ kayıtlı kurumda yazarken
  // takılma hissi vermesin.
  useEffect(() => {
    const timer = setTimeout(() => void search(query), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHits([]);
      // Modal açılır açılmaz yazmaya başlanabilsin.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh] backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
      >
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3 dark:border-white/10">
          <Search className="h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim, öğrenci no, T.C. veya telefon..."
            className="w-full bg-transparent text-sm text-espresso outline-none dark:text-cream"
          />
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-espresso-muted dark:text-cream/40" />}
          <button onClick={onClose} aria-label="Kapat" className="text-espresso-muted dark:text-cream/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query.trim().length < 2 && (
            <p className="px-2 py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
              Aramak için en az 2 karakter yazın.
            </p>
          )}
          {query.trim().length >= 2 && !loading && hits.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Sonuç bulunamadı.</p>
          )}
          {hits.map((hit) => {
            const Icon = ICONS[hit.type];
            return (
              <div
                key={`${hit.type}-${hit.id}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  !hit.isActive && "opacity-50"
                )}
              >
                <Icon className="h-4 w-4 shrink-0 text-brand-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-espresso dark:text-cream">
                    {hit.title}
                    {!hit.isActive && (
                      <span className="ml-1.5 text-[11px] font-normal text-espresso-muted dark:text-cream/40">
                        (kurumdan ayrıldı)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
                    {TYPE_LABEL[hit.type]} · {hit.subtitle}
                  </p>
                </div>
                {/* Borç, müdürün en sık sorduğu ikinci şey — aramada görünsün. */}
                {hit.openDebt != null && hit.openDebt > 0 && (
                  <span className="shrink-0 rounded-lg bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/15 dark:text-red-400">
                    {formatTRY(hit.openDebt)} borç
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
