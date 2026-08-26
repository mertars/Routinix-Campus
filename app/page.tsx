"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Crown, GraduationCap, BookOpen, Users } from "lucide-react";
import { MOCK_PERSONAS, type RoleId } from "@/lib/mock-data";
import { RoleCard } from "@/components/role-select/role-card";
import { AuroraOrbs, GlowLogo, spaceGrotesk, AURORA_GRID_STYLE } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

const PANEL_LABEL: Record<string, string> = {
  principal: "Yönetici Paneli",
  teacher: "Öğretmen Paneli",
  student: "Öğrenci Paneli",
  parent: "Veli Paneli",
};

const ICONS: Record<RoleId, typeof Crown> = {
  principal: Crown,
  teacher: GraduationCap,
  student: BookOpen,
  parent: Users,
};

const ROLE_DESCRIPTION: Record<RoleId, string> = {
  principal: "Kurumu tek panelden yönetin — kadro, şube, risk ve performans tek ekranda.",
  teacher: "Sınıfını, ödevlerini ve öğrenci gelişimini uçtan uca takip et.",
  student: "Netlerini, ödevlerini ve haftalık programını tek yerden gör.",
  parent: "Çocuğunuzun akademik gelişimini gerçek zamanlı izleyin.",
};

// useSearchParams() bir Suspense sınırı içinde olmalı (Next.js App Router
// kuralı) — middleware.ts'in ?denied= yönlendirmesini okuyan tek kısım bu
// yüzden ayrı bir küçük bileşene çıkarıldı, sayfanın geri kalanı statik kalır.
function AccessDeniedNotice() {
  const searchParams = useSearchParams();
  const denied = searchParams.get("denied");
  if (!denied || !PANEL_LABEL[denied]) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 flex max-w-md items-center gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-200"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      Bu rolle {PANEL_LABEL[denied]}&apos;ne erişemezsiniz — devam etmek için doğru rolü seçin.
    </motion.div>
  );
}

export default function RoleSelectPage() {
  const router = useRouter();

  function handleSelect(persona: (typeof MOCK_PERSONAS)[number]) {
    // Rol seçimini URL parametresi olarak gönder
    const loginUrl = `/login?role=${persona.id}`;
    router.push(loginUrl);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#08060B] px-6 py-16">
      <AuroraOrbs />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={AURORA_GRID_STYLE} />

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 mb-12 flex flex-col items-center text-center"
      >
        <GlowLogo size="h-14 w-14" textSize="text-2xl" />
        <h1 className={cn(spaceGrotesk.className, "mt-5 text-3xl font-bold text-white")}>Routinix Kampüs</h1>
        <p className="mt-2 text-sm text-white/40">Devam etmek için rolünü seç</p>
      </motion.div>

      <Suspense fallback={null}>
        <AccessDeniedNotice />
      </Suspense>

      <div className="relative z-10 grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_PERSONAS.map((persona, index) => (
          <RoleCard
            key={persona.id}
            persona={persona}
            icon={ICONS[persona.id]}
            description={ROLE_DESCRIPTION[persona.id]}
            index={index}
            onSelect={() => handleSelect(persona)}
          />
        ))}
      </div>
    </main>
  );
}
