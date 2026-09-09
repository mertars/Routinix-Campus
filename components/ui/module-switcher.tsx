"use client";

import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, Lock } from "lucide-react";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { useAgenda } from "@/lib/agenda-store";
import { MODULES, MODULE_BY_ID, moduleFromPathname, moduleHref, type ModuleId } from "@/lib/modules";
import { cn } from "@/lib/utils";

// MODÜL DEĞİŞTİRİCİ — beş panelin ortak sol bloğu.
//
// Eskiden burada her modülde "hub'a dön" oku vardı: modül değiştirmek
// önce ÇIKMAYI, sonra başka bir kapıdan girmeyi gerektiriyordu. Bu,
// panellerin ayrı sistemler olduğu hissini üreten şeydi. Artık ok yok;
// yerinde bulunduğun modülün adı duruyor ve tek tıkla diğerine geçiliyor.
// Hub hâlâ erişilebilir ama artık zorunlu bir durak değil.
//
// Ayrıca modüller birbirinden HABERDAR: her satır o modülde bekleyen iş
// sayısını taşıyor (Gündem'in zaten hesapladığı veriden — yeni sorgu
// yok). Ödeme panelindeyken ERP'de 5 iş biriktiğini görebiliyorsun;
// sistemin tamamı tek ekrandan okunuyor.

function WorkBadge({ count, critical }: { count: number; critical: number }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
        critical > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-espresso"
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function ModuleSwitcher({ current }: { current?: ModuleId }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const activeId = current ?? moduleFromPathname(pathname);
  const active = MODULE_BY_ID[activeId];
  const isTeacher = pathname.includes("/teacher");

  // Gündem uç noktası yönetici içindir; öğretmen ekranında boşuna
  // istek atılmaz, rozetler de çizilmez.
  const { moduleWork } = useAgenda(!isTeacher);

  // Tetikleyicideki uyarı BAŞKA modüllerdeki işi anlatır: bulunduğun
  // modülün işi zaten ekranında (Gündem paneli / yan menü rozetleri).
  const elsewhere = MODULES.filter((m) => m.id !== activeId).reduce(
    (acc, m) => {
      const work = moduleWork[m.id];
      return { count: acc.count + work.count, critical: acc.critical + work.critical };
    },
    { count: 0, critical: 0 }
  );

  const ActiveIcon = active.icon;

  return (
    <DropdownMenu
      align="left"
      panelClassName="min-w-[268px] py-0"
      trigger={
        <button
          aria-label={`${active.label} — modül değiştir`}
          className={cn(
            "flex h-9 items-center gap-2 rounded-full border px-2.5 shadow-sm transition hover:brightness-[0.97] dark:hover:brightness-110",
            active.accent.border,
            active.accent.bg,
            active.accent.text
          )}
        >
          <ActiveIcon className="h-4 w-4 shrink-0" />
          <span className="hidden max-w-[130px] truncate text-xs font-semibold sm:inline">{active.shortLabel}</span>
          {elsewhere.count > 0 && (
            <span
              className={cn(
                "flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums text-white",
                elsewhere.critical > 0 ? "bg-red-500" : "bg-amber-500 text-espresso"
              )}
              title={`Diğer modüllerde ${elsewhere.count} bekleyen iş`}
            >
              {elsewhere.count > 9 ? "9+" : elsewhere.count}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      }
    >
      <p className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-espresso-muted dark:text-cream/35">
        Modüller
      </p>

      {MODULES.map((mod) => {
        const href = moduleHref(mod, isTeacher);
        const isActive = mod.id === activeId;
        const work = moduleWork[mod.id];
        const Icon = mod.icon;

        return (
          <button
            key={mod.id}
            disabled={!href}
            onClick={() => href && !isActive && router.push(href)}
            className={cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left transition",
              href ? "hover:bg-cream-card dark:hover:bg-white/5" : "cursor-not-allowed opacity-45",
              isActive && "bg-cream-muted dark:bg-white/[0.06]"
            )}
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", mod.accent.bg, mod.accent.text)}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-espresso dark:text-cream">{mod.label}</span>
              {!href && <span className="block text-[10px] text-espresso-muted dark:text-cream/35">Yalnızca yönetim</span>}
            </span>
            {isActive ? (
              <Check className={cn("h-3.5 w-3.5 shrink-0", mod.accent.text)} />
            ) : !href ? (
              <Lock className="h-3 w-3 shrink-0 text-espresso-muted dark:text-cream/30" />
            ) : (
              <WorkBadge count={work.count} critical={work.critical} />
            )}
          </button>
        );
      })}

      <div className="mt-1 border-t border-hairline dark:border-white/10">
        <button
          onClick={() => router.push("/hub")}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-cream-card dark:hover:bg-white/5"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cream-muted text-espresso-muted dark:bg-white/[0.07] dark:text-cream/45">
            <LayoutGrid className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-medium text-espresso-muted dark:text-cream/50">Tüm modüller</span>
        </button>
      </div>
    </DropdownMenu>
  );
}
