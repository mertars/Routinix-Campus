"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";

// Faz Z6 — atama panellerindeki her test türünün küçük "ⓘ" bilgi düğmesi;
// basınca o test türünün kaç soru olduğunu, neyi/nasıl ölçtüğünü DETAYLI
// anlatır. Kullanıcı talebi: metin hiçbir şekilde "yapay zekayla üretildi"
// demesin — kurumun kendi özel soru bankasından geldiği vurgulanır (bu
// doğru da: sorular önceden üretilip doğrulanarak havuza yazılıyor,
// öğrenciye canlı bir AI çağrısı asla yapılmıyor — havuzdan SEÇİLİYOR).
export function XrayInfoButton({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} className="text-espresso-muted transition hover:text-sky-600 dark:text-cream/40 dark:hover:text-sky-400" type="button">
        <Info className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute left-0 top-6 z-10 w-72 rounded-xl border border-hairline bg-white p-3 text-[11px] leading-relaxed text-espresso shadow-lg dark:border-white/10 dark:bg-midnight-card dark:text-cream/80"
          >
            <button onClick={() => setOpen(false)} className="absolute right-2 top-2 text-espresso-muted hover:text-espresso dark:text-cream/40">
              <X className="h-3 w-3" />
            </button>
            <p className="pr-4">{text}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
