"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Faz Q — Röntgen paneli genel düzenlemesi: birden fazla ayrı ikon/pill
// butonu tek bir tetikleyici altında GRUPLAMAK için paylaşılan, hafif bir
// dropdown. Modal'daki Esc-ile-kapatma deseniyle AYNI + dışarı tıklayınca
// da kapanır. Modal'ın aksine tam ekranı KAPLAMAZ — küçük bir popover.
export function DropdownMenu({
  trigger,
  children,
  align = "right",
  className,
  panelClassName,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Kullanıcı geri bildirimi — sayfada aşağı kaydırılmış bir tetikleyiciye
  // tıklanınca panel varsayılan olarak AŞAĞI açılıyordu ve viewport dışında
  // kalıp görünmez oluyordu. Açılışta gerçek panel yüksekliğiyle altta kalan
  // alanı ölçüp yetmiyorsa YUKARI açılışa çeviriyoruz. useLayoutEffect —
  // boyama öncesi çalışır, ilk karede görünür bir sıçrama olmaz.
  useLayoutEffect(() => {
    if (!open || !ref.current || !panelRef.current) return;
    const triggerRect = ref.current.getBoundingClientRect();
    const panelHeight = panelRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    setOpenUpward(spaceBelow < panelHeight + 16 && triggerRect.top > panelHeight + 16);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            onClick={() => setOpen(false)}
            className={cn(
              "absolute z-30 min-w-[200px] overflow-hidden rounded-xl border border-hairline bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-midnight-card",
              openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5",
              align === "right" ? "right-0" : "left-0",
              panelClassName
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function DropdownMenuItem({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
  spinning,
  iconClassName,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  spinning?: boolean;
  iconClassName?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium transition disabled:opacity-50",
        danger ? "text-rose-600 hover:bg-rose-500/10 dark:text-rose-400" : "text-espresso hover:bg-cream-card dark:text-cream dark:hover:bg-white/5"
      )}
    >
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", iconClassName, spinning && "animate-spin")} />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
