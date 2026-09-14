"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, CheckCheck, Loader2, X } from "lucide-react";
import { useIsMobile } from "@/lib/use-media-query";
import {
  loadMore,
  markAllRead,
  markRead,
  setCategory,
  useNotifications,
} from "@/lib/notification-store";
import {
  CATEGORIES_BY_AUDIENCE,
  CATEGORY_LABEL,
  CATEGORY_STYLE,
  eventMeta,
  type ActivityAudience,
  type ActivityCategory,
  type NotificationDto,
} from "@/lib/notifications/events";
import { NotificationIcon } from "@/components/ui/notification-icon";
import { cn } from "@/lib/utils";

// BİLDİRİM KUTUSU — beş panelin ORTAK zili ve paneli.
//
// Kullanıcı kararı (2026-09-14): "tüm panellerde bulunan gerekli tüm
// bildirimlerin geldiği bir bildirim kutusu... yöneticiye çok bildirim
// geliyor bunları gruplarsan ödeme sınıf öğrenci tümü vs. güzel olur".
//
// ⚠️ Duyuru (Announcement) ile KARIŞTIRILMAMALI: duyuru yönetimin herkese
// aynı metni yayınladığı ilan panosudur; bu kutu ise KİŞİYE ÖZEL, olay
// güdümlü bir akıştır ("senin sınıfının yoklaması girildi", "sana etüt
// atandı"). İkisi bilerek ayrı yaşıyor.
//
// Tasarım notu: bu panel kasıtlı olarak projedeki diğer açılır menülerden
// (DropdownMenu) FARKLI bir dil kullanıyor — masaüstünde sağdan kayan tam
// boy bir levha, mobilde alt sayfa. Sebep: içerik uzun ve gezinilebilir
// (sekmeler + sayfalama); 260px'lik bir dropdown'da bu iş görünmez olurdu.

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "az önce";
  if (min < 60) return `${min} dk önce`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} sa önce`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "dün";
  if (day < 7) return `${day} gün önce`;
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

// Gün başlıkları: "Bugün" / "Dün" / "14 Eylül". Liste tarih sırasında
// geldiği için tek geçişte gruplanıyor.
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (isSameDay(d, today)) return "Bugün";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(d, yesterday)) return "Dün";
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
}

function NotificationRow({ item, onOpen }: { item: NotificationDto; onOpen: (item: NotificationDto) => void }) {
  const meta = eventMeta(item.eventType);
  const style = CATEGORY_STYLE[item.category as ActivityCategory] ?? CATEGORY_STYLE.SYSTEM;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(item)}
      className={cn(
        "group relative flex w-full items-start gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left transition",
        item.isRead
          ? "bg-transparent hover:bg-cream-card/70 dark:hover:bg-white/[0.04]"
          : "bg-cream-card/80 hover:bg-cream-card dark:bg-white/[0.055] dark:hover:bg-white/[0.08]"
      )}
    >
      {/* Sol renk şeridi — kategoriyi OKUMADAN ayırt etmeyi sağlar. */}
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-[3px] rounded-full transition-opacity",
          item.urgent ? "bg-rose-500" : style.rail,
          item.isRead && "opacity-30"
        )}
      />

      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
          item.urgent ? "bg-rose-500/12 text-rose-600 dark:text-rose-300" : style.chip
        )}
      >
        <NotificationIcon name={meta.icon} className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              "min-w-0 flex-1 text-[13px] leading-snug text-espresso dark:text-cream",
              item.isRead ? "font-normal" : "font-semibold"
            )}
          >
            {item.title}
          </span>
          {!item.isRead && <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} />}
        </span>

        {item.body && (
          <span className="mt-0.5 block text-[11.5px] leading-snug text-espresso-muted dark:text-cream/45">
            {item.body}
          </span>
        )}

        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-espresso-muted/80 dark:text-cream/35">
          {item.urgent && (
            <span className="rounded-full bg-rose-500/12 px-1.5 py-0.5 font-semibold text-rose-600 dark:text-rose-300">
              Acil
            </span>
          )}
          <span className="rounded-full bg-espresso/[0.06] px-1.5 py-0.5 font-medium dark:bg-white/[0.07]">
            {CATEGORY_LABEL[item.category as ActivityCategory] ?? item.category}
          </span>
          {item.actorName && <span className="truncate">{item.actorName}</span>}
          <span aria-hidden>·</span>
          <span>{timeAgo(item.createdAt)}</span>
        </span>
      </span>
    </motion.button>
  );
}

function InboxPanel({ audience, onClose }: { audience: ActivityAudience; onClose: () => void }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const state = useNotifications(true);
  const categories = CATEGORIES_BY_AUDIENCE[audience] ?? [];

  function openItem(item: NotificationDto) {
    if (!item.isRead) void markRead([item.id]);
    if (item.href) {
      onClose();
      router.push(item.href);
    }
  }

  // Gün gruplaması — liste zaten tarih sırasında, tek geçiş yeterli.
  const groups: { label: string; items: NotificationDto[] }[] = [];
  for (const item of state.items) {
    const label = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const body = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Başlık */}
      <div className="shrink-0 border-b border-hairline px-4 pb-3 pt-4 dark:border-white/10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-600 dark:text-brand-400">
              <Bell className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-espresso dark:text-cream">Bildirimler</h2>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                {state.unreadTotal > 0 ? `${state.unreadTotal} okunmamış bildirim` : "Hepsi okundu"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {state.unreadTotal > 0 && (
              <button
                onClick={() => void markAllRead(state.category)}
                title="Tümünü okundu işaretle"
                className="flex h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:text-cream/45 dark:hover:bg-white/5 dark:hover:text-cream"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tümünü okundu</span>
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Kapat"
              className="flex h-9 w-9 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/45 dark:hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Kategori sekmeleri — kullanıcı isteği: "gruplarsan ödeme sınıf
            öğrenci tümü vs. güzel olur". Rol başına farklı liste
            (CATEGORIES_BY_AUDIENCE). */}
        <div className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CategoryPill
            label="Tümü"
            count={state.unreadTotal}
            active={state.category === null}
            onClick={() => setCategory(null)}
          />
          {categories.map((c) => (
            <CategoryPill
              key={c}
              label={CATEGORY_LABEL[c]}
              count={state.unreadByCategory[c] ?? 0}
              active={state.category === c}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      </div>

      {/* Liste */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2">
        {state.items.length === 0 && !state.loading && (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/30">
              <BellOff className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-espresso dark:text-cream">Bildirim yok</p>
            <p className="max-w-[220px] text-[11.5px] leading-snug text-espresso-muted dark:text-cream/40">
              {state.category
                ? "Bu başlıkta henüz bir hareket olmamış."
                : "Sistemde seni ilgilendiren bir hareket olduğunda burada görünecek."}
            </p>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="sticky top-0 z-10 bg-white/85 px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-espresso-muted backdrop-blur-sm dark:bg-midnight-card/85 dark:text-cream/35">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NotificationRow key={item.id} item={item} onOpen={openItem} />
              ))}
            </div>
          </div>
        ))}

        {state.loading && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-espresso-muted dark:text-cream/40" />
          </div>
        )}

        {state.nextCursor && !state.loading && (
          <button
            onClick={() => void loadMore()}
            className="mx-auto mb-2 mt-1 block rounded-full border border-hairline px-4 py-1.5 text-[11px] font-medium text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:border-white/10 dark:text-cream/45 dark:hover:bg-white/5"
          >
            Daha eskiler
          </button>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[80] bg-espresso/25 backdrop-blur-[2px] dark:bg-black/50"
      />
      {isMobile ? (
        <motion.div
          key="sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 34 }}
          className="fixed inset-x-0 bottom-0 z-[90] flex max-h-[85vh] flex-col rounded-t-3xl border-t border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex shrink-0 justify-center pt-2.5">
            <span className="h-1.5 w-10 rounded-full bg-hairline dark:bg-white/20" />
          </div>
          {body}
        </motion.div>
      ) : (
        <motion.div
          key="drawer"
          initial={{ x: "100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 300, damping: 32 }}
          className="fixed inset-y-0 right-0 z-[90] flex w-full max-w-[420px] flex-col border-l border-hairline bg-white shadow-2xl dark:border-white/10 dark:bg-midnight-card"
        >
          {body}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function CategoryPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/45 dark:hover:bg-white/5"
      )}
    >
      {label}
      {count > 0 && (
        <span
          className={cn(
            "flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold tabular-nums",
            active ? "bg-white/25 text-white" : "bg-brand-500/15 text-brand-700 dark:text-brand-300"
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

/**
 * Üst çubuklara konan zil. `audience` oturumun rolüdür — hangi kategori
 * sekmelerinin görüneceğini belirler (öğrenciye "Ödeme" sekmesi açılmaz).
 */
export function NotificationBell({ audience, compact = false }: { audience: ActivityAudience; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { unreadTotal } = useNotifications(true);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={unreadTotal > 0 ? `Bildirimler — ${unreadTotal} okunmamış` : "Bildirimler"}
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full border border-hairline bg-white/70 text-espresso shadow-sm transition hover:bg-cream-card dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream dark:hover:bg-white/5",
          compact ? "h-10 w-10" : "h-9 w-9"
        )}
      >
        <Bell className={cn(compact ? "h-[18px] w-[18px]" : "h-4 w-4")} />
        {unreadTotal > 0 && (
          <>
            {/* Okunmamış varken hafif bir nabız — dikkat çeker ama
                sürekli dönen bir animasyon kadar rahatsız etmez. */}
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9.5px] font-bold tabular-nums text-white shadow-sm">
              {unreadTotal > 99 ? "99+" : unreadTotal}
            </span>
            <span className="absolute -right-0.5 -top-0.5 h-4 w-4 animate-ping rounded-full bg-rose-500/40 [animation-duration:2.4s]" />
          </>
        )}
      </button>

      <AnimatePresence>{open && <InboxPanel audience={audience} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  );
}
