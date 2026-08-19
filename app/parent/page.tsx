"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, ArrowLeft } from "lucide-react";

// Veli paneli henüz geliştirilmedi — bu, kırık/boş bir rotayla
// karşılaşılmasın diye eklenmiş dürüst bir "yakında" yer tutucusudur.
export default function ParentPlaceholderPage() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center dark:bg-midnight">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-espresso/8 text-espresso dark:bg-brand-600/15 dark:text-brand-500">
          <Users className="h-8 w-8" />
        </span>
        <h1 className="text-lg font-semibold text-espresso dark:text-cream">Veli Paneli Yakında</h1>
        <p className="max-w-sm text-sm text-espresso-muted dark:text-cream/40">
          Veli girişi ve takip ekranları henüz geliştirme aşamasında değil. Bu modül hazır olduğunda burada yayına alınacak.
        </p>
        <button
          onClick={() => router.push("/")}
          className="mt-2 flex min-h-[44px] items-center gap-1.5 rounded-xl border border-hairline px-4 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          <ArrowLeft className="h-4 w-4" /> Rol Seçimine Dön
        </button>
      </motion.div>
    </main>
  );
}
