"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Search, Loader2, GraduationCap, UserCog2, Users, CornerDownLeft, type LucideIcon } from "lucide-react";
import { closeCommandPalette, openCommandPalette, useCommandPaletteOpen } from "@/lib/command-palette-store";
import { openStudent360 } from "@/lib/student-360-store";
import { requestErpTab } from "@/lib/erp-tab-store";
import { ERP_TABS, type ErpTabId } from "@/lib/erp-tabs";
import { PAYMENT_TABS } from "@/lib/payment-tabs";
import { canAccessTab, type PaymentRole } from "@/lib/payments/payment-roles";
import { MODULES, moduleHref, paymentsHref } from "@/lib/modules";
import { cn } from "@/lib/utils";

// KOMUT PALETİ (⌘K) — sistemin tamamı tek kutudan.
//
// Öncesinde bu yalnızca ERP üst çubuğundaki bir "kişi arama" kutusuydu:
// diğer dört modülde hiç yoktu ve yalnızca öğrenci/öğretmen/veli arıyordu.
// Yani müdür "bordro" yazıp bordroya gidemiyordu — 29 sekmenin hangisinde
// olduğunu hatırlamak zorundaydı.
//
// Artık aynı kutu ÜÇ şeyi birden arıyor: kişiler, beş modül ve 29 sekme.
// Kişi sonucu Öğrenci 360 kartını açar, sekme sonucu doğrudan o sekmeye
// götürür. Palet kök düzende TEK kez mount edilir ve ⌘K dinleyicisini
// kendisi kurar — altı üst çubuğun ayrı ayrı kısayol kurması gerekmez.

type PersonHit = {
  id: string;
  type: "STUDENT" | "TEACHER" | "PARENT";
  title: string;
  subtitle: string;
  isActive: boolean;
  openDebt?: number | null;
};

type PaletteItem = {
  key: string;
  group: string;
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  iconClass?: string;
  badge?: string;
  badgeClass?: string;
  dim?: boolean;
  run: () => void;
};

const PERSON_ICON: Record<PersonHit["type"], LucideIcon> = {
  STUDENT: GraduationCap,
  TEACHER: UserCog2,
  PARENT: Users,
};

const PERSON_LABEL: Record<PersonHit["type"], string> = {
  STUDENT: "Öğrenci",
  TEACHER: "Öğretmen",
  PARENT: "Veli",
};

const GROUP_ORDER = ["Kişiler", "Modüller", "Kampüs ERP", "Ödeme Takip"];

function normalize(value: string): string {
  return value.toLocaleLowerCase("tr").trim();
}

/** Etikette ya da anahtar sözcüklerde geçiyor mu. */
function matches(query: string, label: string, keywords?: string[]): boolean {
  if (!query) return true;
  const haystack = normalize([label, ...(keywords ?? [])].join(" "));
  return query.split(/\s+/).every((word) => haystack.includes(word));
}

function formatTRY(n: number): string {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

export function CommandPalette() {
  const isOpen = useCommandPaletteOpen();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isTeacher = pathname.includes("/teacher");

  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paymentRole, setPaymentRole] = useState<PaymentRole | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K her ekranda — dinleyici TEK yerde.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommandPalette();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ödeme sekmeleri yetkiye göre süzülür: erişemeyeceği bir sekmeyi
  // arama sonucunda göstermek, tıklayınca başka yere düşürürdü.
  useEffect(() => {
    if (!isOpen || isTeacher || paymentRole !== null) return;
    fetch("/api/payments/principal/me")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setPaymentRole(data.paymentRole as PaymentRole))
      .catch(() => setPaymentRole("NONE"));
  }, [isOpen, isTeacher, paymentRole]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setPeople([]);
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  // Kişi araması sunucuda ve yalnızca yöneticide (uç nokta öyle korunuyor).
  useEffect(() => {
    if (!isOpen || isTeacher) return;
    const q = query.trim();
    if (q.length < 2) {
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = window.setTimeout(() => {
      fetch(`/api/admin/search?q=${encodeURIComponent(q)}`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
        .then((data) => setPeople(data.hits ?? []))
        .catch(() => setPeople([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, isOpen, isTeacher]);

  const go = useCallback(
    (action: () => void) => {
      closeCommandPalette();
      action();
    },
    []
  );

  const items = useMemo<PaletteItem[]>(() => {
    const q = normalize(query);
    const list: PaletteItem[] = [];

    for (const hit of people) {
      list.push({
        key: `person-${hit.type}-${hit.id}`,
        group: "Kişiler",
        label: hit.title,
        sublabel: `${PERSON_LABEL[hit.type]} · ${hit.subtitle}${hit.isActive ? "" : " · kurumdan ayrıldı"}`,
        icon: PERSON_ICON[hit.type],
        iconClass: "text-brand-600",
        dim: !hit.isActive,
        badge: hit.openDebt != null && hit.openDebt > 0 ? `${formatTRY(hit.openDebt)} borç` : undefined,
        badgeClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
        // Öğrenci → 360 kartı. Öğretmen/veli için henüz birleşik kart yok;
        // satır bilgi olarak durur, tıklanınca bir şey vaat etmez.
        run: hit.type === "STUDENT" ? () => openStudent360(hit.id) : () => {},
      });
    }

    for (const mod of MODULES) {
      if (!matches(q, mod.label, [mod.shortLabel, mod.description])) continue;
      const href = moduleHref(mod, isTeacher);
      if (!href) continue;
      list.push({
        key: `module-${mod.id}`,
        group: "Modüller",
        label: mod.label,
        sublabel: "Modüle git",
        icon: mod.icon,
        iconClass: mod.accent.text,
        run: () => router.push(href),
      });
    }

    for (const tab of ERP_TABS) {
      if (!matches(q, tab.label, tab.keywords)) continue;
      list.push({
        key: `erp-${tab.id}`,
        group: "Kampüs ERP",
        label: tab.label,
        sublabel: "Sekme",
        icon: tab.icon,
        iconClass: "text-brand-600",
        run: () => {
          if (!requestErpTab(tab.id as ErpTabId)) router.push("/principal");
        },
      });
    }

    if (!isTeacher && paymentRole && paymentRole !== "NONE") {
      for (const tab of PAYMENT_TABS) {
        if (!canAccessTab(paymentRole, tab.id)) continue;
        if (!matches(q, tab.label, tab.keywords)) continue;
        list.push({
          key: `pay-${tab.id}`,
          group: "Ödeme Takip",
          label: tab.label,
          sublabel: "Sekme",
          icon: tab.icon,
          iconClass: "text-emerald-600 dark:text-emerald-400",
          run: () => router.push(paymentsHref(tab.id)),
        });
      }
    }

    list.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    return list;
  }, [people, query, isTeacher, paymentRole, router]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  // Klavyeyle gezinme — palet fare gerektirmemeli.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCommandPalette();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (items.length === 0) return;
        setActiveIndex((prev) => (prev + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
        return;
      }
      if (event.key === "Enter") {
        const item = items[activeIndex];
        if (item) {
          event.preventDefault();
          go(item.run);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, items, activeIndex, go]);

  // Klavyeyle inilen satır görünür kalsın.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (typeof document === "undefined") return null;

  let renderedGroup = "";

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCommandPalette}
            className="fixed inset-0 z-[75] bg-espresso/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="fixed left-1/2 top-[12vh] z-[80] w-[92vw] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
          >
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-3 dark:border-white/10">
              <Search className="h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/40" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isTeacher ? "Modül veya sekme ara…" : "Kişi, modül veya sekme ara…"}
                className="w-full bg-transparent text-sm text-espresso outline-none placeholder:text-espresso-muted/70 dark:text-cream dark:placeholder:text-cream/30"
              />
              {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-espresso-muted dark:text-cream/40" />}
            </div>

            <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-1.5">
              {items.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-espresso-muted dark:text-cream/40">
                  {query.trim() ? "Sonuç bulunamadı." : "Aramaya başlayın."}
                </p>
              )}

              {items.map((item, index) => {
                const showGroup = item.group !== renderedGroup;
                renderedGroup = item.group;
                const active = index === activeIndex;
                const Icon = item.icon;

                return (
                  <div key={item.key}>
                    {showGroup && (
                      <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-espresso-muted dark:text-cream/35">
                        {item.group}
                      </p>
                    )}
                    <button
                      data-active={active}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(item.run)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                        active && "bg-cream-card dark:bg-white/[0.07]",
                        item.dim && "opacity-55"
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", item.iconClass ?? "text-espresso-muted")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-espresso dark:text-cream">{item.label}</span>
                        {item.sublabel && (
                          <span className="block truncate text-[11px] text-espresso-muted dark:text-cream/40">{item.sublabel}</span>
                        )}
                      </span>
                      {item.badge && (
                        <span className={cn("shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium", item.badgeClass)}>
                          {item.badge}
                        </span>
                      )}
                      {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/30" />}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 border-t border-hairline px-4 py-2 text-[10px] text-espresso-muted dark:border-white/10 dark:text-cream/35">
              <span>↑↓ gez</span>
              <span>↵ aç</span>
              <span>esc kapat</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
