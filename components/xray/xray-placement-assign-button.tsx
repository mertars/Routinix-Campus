"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { XrayPlacementAssignModal } from "@/components/xray/xray-placement-assign-modal";
import type { XrayRosterStudent } from "@/components/xray/xray-results-panel";

// Faz Q — kullanıcı geri bildirimi: eskiden bu buton DOĞRUDAN o an seçili
// öğrenciye atıyordu — artık bir MENÜ açıyor (bkz. XrayPlacementAssignModal),
// çünkü "istediği öğrenciye atsın, atmadığı öğrencileri de göstersin" ve
// "sonradan kayıt olan biri de çözmeli" — tek öğrencilik değil, SÜREKLİ
// güncellenen bir "kim eksik" listesi gerekiyordu.
export function XrayPlacementAssignButton({ roster, subject }: { roster: XrayRosterStudent[]; subject: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4 dark:border-sky-400/20 dark:bg-sky-400/5"
      >
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
          <ClipboardCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Seviye Belirleme Sınavı
        </h3>
        <p className="mb-3 text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
          Sınıf seviyesine göre kapsamlı bir ilk tanı testi atar (12. sınıf/mezunlarda 9-12. sınıf müfredatının tamamı) — tüm kazanım analizini tek seferde doldurur.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
        >
          <ClipboardCheck className="h-3.5 w-3.5" /> Atama Menüsünü Aç
        </button>
      </motion.div>
      <XrayPlacementAssignModal isOpen={open} onClose={() => setOpen(false)} roster={roster} subject={subject} />
    </>
  );
}
