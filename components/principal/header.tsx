"use client";

import { useRouter } from "next/navigation";
import { useRole } from "@/lib/role-context";

export function PrincipalHeader() {
  const router = useRouter();
  const { persona, clearRole } = useRole();

  function handleRoleSwitch() {
    clearRole();
    router.push("/");
  }

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
          onClick={handleRoleSwitch}
          className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso-muted transition hover:bg-cream-card"
        >
          Rol Değiştir
        </button>
      </div>
    </header>
  );
}
