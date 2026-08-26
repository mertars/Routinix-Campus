"use client";

import { useRole, useLogout } from "@/lib/role-context";

export function PrincipalHeader() {
  const { persona } = useRole();
  const handleLogout = useLogout();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-hairline bg-white px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-espresso text-sm font-bold text-cream">
          R
        </div>
        <span className="hidden text-sm font-semibold text-espresso sm:inline">Routinix Kampüs</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-full bg-espresso px-3 py-1.5 sm:flex">
          <span className="text-sm font-medium text-cream">{persona?.name ?? "Mert"}</span>
          <span className="text-xs text-cream/40">·</span>
          <span className="text-xs text-cream/70">{persona?.title ?? "Kurum Müdürü"}</span>
        </div>
        <button
          onClick={handleLogout}
          className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
        >
          Çıkış Yap
        </button>
      </div>
    </header>
  );
}
