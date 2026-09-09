"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { AuroraOrbs, GlowLogo, spaceGrotesk, AURORA_GRID_STYLE } from "@/components/ui/aurora-brand";
import { useLogout } from "@/lib/role-context";
import { useToast } from "@/lib/toast-context";
import { MODULES, moduleHref, type ModuleDef } from "@/lib/modules";
import { useAgenda, type ModuleWork } from "@/lib/agenda-store";
import { cn } from "@/lib/utils";

type RoleId = "principal" | "teacher" | null;

type SessionInfo = { name: string; roleId: RoleId; institutionName: string | null };

function ModuleCard({
  module: mod,
  index,
  onSelect,
  enabled,
  work,
}: {
  module: ModuleDef;
  index: number;
  onSelect: () => void;
  enabled: boolean;
  work: ModuleWork;
}) {
  const Icon = mod.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: "easeOut" }}
      whileHover={enabled ? { y: -4 } : undefined}
      whileTap={enabled ? { scale: 0.98 } : undefined}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-[220px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-6 text-center shadow-xl backdrop-blur-sm transition-colors duration-300",
        enabled
          ? "border-white/10 bg-white/[0.04] hover:border-[#FF8C00]/40 cursor-pointer"
          : "border-white/5 bg-white/[0.02] cursor-not-allowed"
      )}
    >
      {!enabled && (
        <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
          Yalnızca yönetim
        </span>
      )}
      {/* Hub artık sadece bir kapı değil: hangi modülde iş biriktiği
          girmeden önce görünüyor. Sayı Gündem'in zaten hesapladığı
          veriden gelir (bkz. lib/agenda-store.ts) — yeni sorgu yok. */}
      {enabled && work.count > 0 && (
        <span
          className={cn(
            "absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
            work.critical > 0 ? "bg-red-500 text-white" : "bg-amber-500 text-[#2C221E]"
          )}
        >
          {work.count} iş
        </span>
      )}
      {enabled && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-[1.5rem] bg-gradient-to-br from-[#FF6B00]/0 to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:from-[#FF6B00]/40 group-hover:opacity-100"
          aria-hidden
        />
      )}
      <div
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full border transition-transform duration-300",
          enabled
            ? "border-[#FF8C00]/20 bg-[#FF8C00]/10 text-[#FFA347] group-hover:scale-110"
            : "border-white/10 bg-white/[0.04] text-white/30"
        )}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div className="relative">
        <p className={cn("text-sm font-semibold", enabled ? "text-white" : "text-white/50")}>{mod.label}</p>
        <p className={cn("mt-1.5 text-xs leading-relaxed", enabled ? "text-white/40" : "text-white/25")}>
          {mod.description}
        </p>
      </div>
    </motion.button>
  );
}

export default function HubPage() {
  const router = useRouter();
  const logout = useLogout();
  const { showToast } = useToast();
  const [session, setSession] = useState<SessionInfo>({ name: "", roleId: null, institutionName: null });

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setSession({ name: data.name ?? "", roleId: data.role ?? null, institutionName: data.institutionName ?? null }))
      .catch(() => {});
  }, []);

  const isTeacher = session.roleId === "teacher";
  // Gündem uç noktası yönetici içindir; rol belli olana kadar da beklenir.
  const { moduleWork } = useAgenda(session.roleId === "principal");

  function handleSelect(mod: ModuleDef) {
    const href = moduleHref(mod, isTeacher);
    // Ödeme Takip'in Faz 1'inde öğretmen görünümü YOK (finansal veri sadece
    // yönetim + veli). Adres null gelirse middleware'in "yanlış rol"
    // yönlendirmesine düşmek yerine burada net bir mesaj gösterilir.
    if (!href) {
      showToast("info", `${mod.label} yalnızca yönetici hesaplarına açıktır.`);
      return;
    }
    router.push(href);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#08060B] px-6 py-16">
      <AuroraOrbs />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={AURORA_GRID_STYLE} />

      <button
        onClick={logout}
        className="absolute right-6 top-6 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm transition hover:border-red-400/30 hover:text-red-300"
      >
        <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
      </button>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 mb-12 flex flex-col items-center text-center"
      >
        <GlowLogo size="h-14 w-14" textSize="text-2xl" />
        <h1 className={cn(spaceGrotesk.className, "mt-5 text-3xl font-bold text-white")}>Routinix Kampüs</h1>
        <p className="mt-2 text-sm text-white/40">
          {session.name ? `Hoş geldin, ${session.name}` : "Hoş geldin"}
          {session.institutionName ? ` · ${session.institutionName}` : ""} — devam etmek için bir modül seç
        </p>
      </motion.div>

      <div className="relative z-10 grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {MODULES.map((mod, index) => (
          <ModuleCard
            key={mod.id}
            module={mod}
            index={index}
            enabled={moduleHref(mod, isTeacher) !== null}
            work={moduleWork[mod.id]}
            onSelect={() => handleSelect(mod)}
          />
        ))}
      </div>
    </main>
  );
}
