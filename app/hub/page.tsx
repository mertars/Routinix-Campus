"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Building2, Scan, FileBarChart, Clapperboard, Wallet, LogOut, type LucideIcon } from "lucide-react";
import { AuroraOrbs, GlowLogo, spaceGrotesk, AURORA_GRID_STYLE } from "@/components/ui/aurora-brand";
import { useLogout } from "@/lib/role-context";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type RoleId = "principal" | "teacher" | null;

type SessionInfo = { name: string; roleId: RoleId; institutionName: string | null };

type ModuleDef = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  active: boolean;
};

const MODULES: ModuleDef[] = [
  {
    id: "erp",
    label: "Kampüs ERP & Finans",
    description: "Kadro, şube, yoklama, ödev ve tüm mevcut yönetim araçları.",
    icon: Building2,
    active: true,
  },
  {
    id: "xray",
    label: "Akademik Röntgen",
    description: "Öğrenci bazlı derin performans ve konu analizi.",
    icon: Scan,
    active: true,
  },
  {
    id: "measurement",
    label: "Ölçme Değerlendirme",
    description: "Deneme sonuçlarını kazanım bazlı analiz et, Akademik Röntgen'i otomatik besle.",
    icon: FileBarChart,
    active: true,
  },
  {
    id: "video",
    label: "Video Ders Merkezi",
    description: "Konu anlatım videolarını yükle, sınıf/ders/konuya göre grupla, öğrenciye tek tuşla ata.",
    icon: Clapperboard,
    active: true,
  },
  {
    id: "payments",
    label: "Ödeme Takip",
    description: "Ödeme ve tahsilat takibi merkezi.",
    icon: Wallet,
    active: false,
  },
];

function ModuleCard({
  module: mod,
  index,
  onSelect,
}: {
  module: ModuleDef;
  index: number;
  onSelect: () => void;
}) {
  const Icon = mod.icon;
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: "easeOut" }}
      whileHover={mod.active ? { y: -4 } : undefined}
      whileTap={mod.active ? { scale: 0.98 } : undefined}
      onClick={onSelect}
      className={cn(
        "group relative flex min-h-[220px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border p-6 text-center shadow-xl backdrop-blur-sm transition-colors duration-300",
        mod.active
          ? "border-white/10 bg-white/[0.04] hover:border-[#FF8C00]/40 cursor-pointer"
          : "border-white/5 bg-white/[0.02] cursor-not-allowed"
      )}
    >
      {!mod.active && (
        <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
          Yakında
        </span>
      )}
      {mod.active && (
        <div
          className="pointer-events-none absolute -inset-1 rounded-[1.5rem] bg-gradient-to-br from-[#FF6B00]/0 to-transparent opacity-0 blur-xl transition-opacity duration-300 group-hover:from-[#FF6B00]/40 group-hover:opacity-100"
          aria-hidden
        />
      )}
      <div
        className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full border transition-transform duration-300",
          mod.active
            ? "border-[#FF8C00]/20 bg-[#FF8C00]/10 text-[#FFA347] group-hover:scale-110"
            : "border-white/10 bg-white/[0.04] text-white/30"
        )}
      >
        <Icon className="h-7 w-7" />
      </div>
      <div className="relative">
        <p className={cn("text-sm font-semibold", mod.active ? "text-white" : "text-white/50")}>{mod.label}</p>
        <p className={cn("mt-1.5 text-xs leading-relaxed", mod.active ? "text-white/40" : "text-white/25")}>
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

  function handleSelect(mod: ModuleDef) {
    if (!mod.active) {
      showToast("info", `${mod.label} yakında aktif olacak.`);
      return;
    }
    const isTeacher = session.roleId === "teacher";
    if (mod.id === "xray") router.push(isTeacher ? "/xray/teacher" : "/xray/principal");
    else if (mod.id === "video") router.push(isTeacher ? "/videos/teacher" : "/videos/principal");
    else if (mod.id === "measurement") router.push(isTeacher ? "/olcme/teacher" : "/olcme/principal");
    else router.push(isTeacher ? "/teacher" : "/principal");
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
          <ModuleCard key={mod.id} module={mod} index={index} onSelect={() => handleSelect(mod)} />
        ))}
      </div>
    </main>
  );
}
