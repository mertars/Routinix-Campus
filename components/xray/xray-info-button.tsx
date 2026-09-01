"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";

// Faz Z6 — atama panellerindeki her test türünün küçük "ⓘ" bilgi düğmesi;
// basınca o test türünün kaç soru olduğunu, neyi/nasıl ölçtüğünü DETAYLI
// anlatır. Kullanıcı talebi: metin hiçbir şekilde "yapay zekayla üretildi"
// demesin — kurumun kendi özel soru bankasından geldiği vurgulanır (bu
// doğru da: sorular önceden üretilip doğrulanarak havuza yazılıyor,
// öğrenciye canlı bir AI çağrısı asla yapılmıyor — havuzdan SEÇİLİYOR).
//
// Faz kullanıcı geri bildirimi — eskiden "Test Ata" sütununun içinde
// absolute+sabit genişlikte (w-72) konumlanan bir popover'dı; sütun dar/
// ekranın sağına yakın olduğunda ekrandan TAŞIYORDU. Artık paylaşılan
// Modal(variant="center") kullanılıyor — nerede tıklanırsa tıklansın her
// zaman ekranın ortasında, viewport sınırlarına göre güvenle açılır.
export function XrayInfoButton({ text, title = "Bu test hakkında" }: { text: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-espresso-muted transition hover:text-sky-600 dark:text-cream/40 dark:hover:text-sky-400" type="button" aria-label={title}>
        <Info className="h-3.5 w-3.5" />
      </button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={title} variant="center" widthClassName="max-w-sm">
        <p className="text-[13px] leading-relaxed text-espresso dark:text-cream/80">{text}</p>
      </Modal>
    </>
  );
}
