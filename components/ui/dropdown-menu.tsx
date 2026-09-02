"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type Rect = { top: number; bottom: number; left: number; right: number };

// Faz Q — Röntgen paneli genel düzenlemesi: birden fazla ayrı ikon/pill
// butonu tek bir tetikleyici altında GRUPLAMAK için paylaşılan, hafif bir
// dropdown. Modal'daki Esc-ile-kapatma deseniyle AYNI + dışarı tıklayınca
// da kapanır. Modal'ın aksine tam ekranı KAPLAMAZ — küçük bir popover.
//
// Kullanıcı geri bildirimi — panel eskiden tetikleyicinin İÇİNDE (aynı
// `position: relative` kapsayıcının çocuğu olarak, `position: absolute`
// ile) render ediliyordu. Tetikleyici, kendisi bir stacking context kuran
// bir ata içindeyse (ör. framer-motion `transform`/`backdrop-blur` — bu
// panelde StatCard'lar TAM OLARAK bunu yapıyor), panel z-index'i SADECE o
// atanın içinde geçerli oluyor; atadan SONRA gelen bir kardeş (ör. sonraki
// StatCard grid'i) panelin üstüne "boyanabiliyor" (Rapor/Veliye Gönder
// menüleri altta kalıp görünmez oluyordu). Kalıcı çözüm: panel
// `document.body`'ye PORTAL'lanır (bkz. Modal ile AYNI desen), konumu
// tetikleyicinin gerçek ekran koordinatlarından `position: fixed` ile
// hesaplanır — hiçbir atanın stacking context'ine bağımlı KALMAZ.
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
  const [rect, setRect] = useState<Rect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    // Sayfa kaydırılınca (window ya da sağ sütun gibi iç içe bir
    // overflow-y-auto konteyner — capture:true bunu da yakalar) tetikleyici
    // yer değiştirir, sabit-konumlu paneli sürekli yeniden hesaplamak
    // yerine basitçe kapatıyoruz.
    function handleScroll() {
      setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !ref.current) {
      setRect(null);
      return;
    }
    const triggerRect = ref.current.getBoundingClientRect();
    setRect({ top: triggerRect.top, bottom: triggerRect.bottom, left: triggerRect.left, right: triggerRect.right });
  }, [open]);

  // rect ilk ölçüldüğünde panel henüz mount olmamıştı (yüksekliği bilinmiyor,
  // openUpward varsayılan false) — panel mount olduktan SONRA gerçek
  // yüksekliğiyle yeniden ölçüp gerekirse yukarı açılışa çeviriyoruz.
  // useLayoutEffect — boyama öncesi çalışır, görünür bir sıçrama olmaz.
  useLayoutEffect(() => {
    if (!rect || !panelRef.current) return;
    const panelHeight = panelRef.current.offsetHeight;
    const spaceBelow = window.innerHeight - rect.bottom;
    setOpenUpward(spaceBelow < panelHeight + 16 && rect.top > panelHeight + 16);
  }, [rect]);

  return (
    <div ref={ref} className={cn("inline-block", className)}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && rect && (
              <motion.div
                ref={panelRef}
                initial={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: openUpward ? 4 : -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                onClick={() => setOpen(false)}
                style={{
                  position: "fixed",
                  top: openUpward ? undefined : rect.bottom + 6,
                  bottom: openUpward ? window.innerHeight - rect.top + 6 : undefined,
                  left: align === "left" ? rect.left : undefined,
                  right: align === "right" ? window.innerWidth - rect.right : undefined,
                }}
                className={cn(
                  "z-[55] min-w-[200px] overflow-hidden rounded-xl border border-hairline bg-white py-1.5 shadow-xl dark:border-white/10 dark:bg-midnight-card",
                  panelClassName
                )}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
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
