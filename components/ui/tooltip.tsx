import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Kullanıcı geri bildirimi — ikon-only butonlar (Hedef Belirle, ortalama
// rozeti) uzaktan ne işe yaradığı belli olmuyordu. Native `title` yerine
// saf CSS (group-hover) ile estetik, küçük bir tooltip — JS state
// gerekmez, her kullanım yeri için hafif kalır.
export function Tooltip({ label, children, side = "bottom", className }: { label: string; children: ReactNode; side?: "top" | "bottom"; className?: string }) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-lg bg-espresso px-2.5 py-1.5 text-[11px] font-medium text-cream opacity-0 shadow-lg transition-all duration-150 group-hover/tooltip:opacity-100 dark:bg-cream dark:text-espresso",
          side === "bottom" ? "top-full mt-2 translate-y-1 group-hover/tooltip:translate-y-0" : "bottom-full mb-2 -translate-y-1 group-hover/tooltip:translate-y-0"
        )}
      >
        {label}
      </span>
    </span>
  );
}
