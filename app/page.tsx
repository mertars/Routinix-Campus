"use client";

import { Suspense } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, Crown, GraduationCap, BookOpen, Users } from "lucide-react";
import { useRole } from "@/lib/role-context";
import { MOCK_PERSONAS, type RoleId } from "@/lib/mock-data";
import { RoleCard } from "@/components/role-select/role-card";
import { ThemeToggle } from "@/components/theme-toggle";

const PANEL_LABEL: Record<string, string> = {
  principal: "Yönetici Paneli",
  teacher: "Öğretmen Paneli",
  student: "Öğrenci Paneli",
};

const ICONS: Record<RoleId, typeof Crown> = {
  principal: Crown,
  teacher: GraduationCap,
  student: BookOpen,
};

const TONES: Record<RoleId, "espresso" | "amber" | "green"> = {
  principal: "espresso",
  teacher: "amber",
  student: "green",
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
      className="mb-6 flex max-w-md items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      Bu rolle {PANEL_LABEL[denied]}&apos;ne erişemezsiniz — devam etmek için doğru rolü seçin.
    </motion.div>
  );
}

export default function RoleSelectPage() {
  const router = useRouter();
  const { selectRole } = useRole();

  function handleSelect(persona: (typeof MOCK_PERSONAS)[number]) {
    selectRole(persona.id);
    router.push(persona.href);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-cream px-6 py-16 dark:bg-midnight">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-12 text-center"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-espresso text-xl font-bold text-cream dark:bg-brand-600">
          R
        </div>
        <h1 className="text-2xl font-semibold text-espresso dark:text-cream">Routinix Kampüs</h1>
        <p className="mt-1 text-sm text-espresso-muted dark:text-cream/40">Devam etmek için rolünü seç</p>
      </motion.div>

      <Suspense fallback={null}>
        <AccessDeniedNotice />
      </Suspense>

      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MOCK_PERSONAS.map((persona, index) => (
          <RoleCard
            key={persona.id}
            persona={persona}
            icon={ICONS[persona.id]}
            tone={TONES[persona.id]}
            index={index}
            onSelect={() => handleSelect(persona)}
          />
        ))}
        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: MOCK_PERSONAS.length * 0.08, ease: "easeOut" }}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/parent")}
          className="flex min-h-[168px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-hairline bg-cream-card/60 p-6 text-center opacity-80 transition-colors hover:border-brand-600/40 dark:border-white/10 dark:bg-midnight-card/60"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-espresso/8 text-espresso dark:bg-brand-600/15 dark:text-brand-500">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-espresso dark:text-cream">Veli Girişi</p>
            <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">Yakında</p>
          </div>
        </motion.button>
      </div>
    </main>
  );
}
