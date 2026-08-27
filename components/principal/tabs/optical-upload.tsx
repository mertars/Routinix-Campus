"use client";

import { motion } from "framer-motion";
import { FileClock, ListChecks } from "lucide-react";

// ⚠️ Bu sekme daha önce dosya İÇERİĞİNİ hiç okumadan, seçilen dosyanın
// adını alıp her öğrenci için SAHTE (Math.random()) bir net üretip
// veritabanına KALICI yazan bir "yükleme" akışıydı — ilerleme animasyonu
// ve "şube ortalamaları güncellendi" mesajıyla gerçek gibi görünüyordu.
// Optik okuma firmanızın çıktısı SADECE PDF olduğundan (Excel/CSV yok),
// güvenilir bir ayrıştırıcı gerçek bir örnek PDF üzerinden tasarlanana
// kadar bu sekme BİLEREK sadece bilgilendirici — hiçbir dosya kabul
// etmiyor, veritabanına hiçbir şey yazmıyor.
export function OpticalUploadTab() {
  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 text-sm font-semibold text-espresso dark:text-cream">Deneme Sınavı Sonucu — Optik Okuma İçe Aktarma</h2>
      <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
        Bu özellik henüz hazır değil — gerçek bir PDF örneği üzerinden ayrıştırıcı tasarlanıyor. Sahte veri üretmemek için dosya yükleme şimdilik kapalı.
      </p>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-hairline px-6 py-14 text-center dark:border-white/10">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          <FileClock className="h-6 w-6" />
        </div>
        <p className="text-sm font-medium text-espresso dark:text-cream">Yakında</p>
        <p className="max-w-sm text-xs text-espresso-muted dark:text-cream/40">
          Optik okuma raporlarınızın gerçek düzenini görmeden güvenilir bir ayrıştırıcı yazamayız — yanlış eşleşmiş bir net, öğrenciye gerçek performansıymış gibi gösterilir.
        </p>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-brand-50 px-3 py-2.5 text-xs text-brand-700 dark:bg-brand-600/10 dark:text-brand-300">
        <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Bu arada netleri Sınav Yönetimi ekranından öğrenci başına elle girebilirsiniz — doğru/yanlış sayısı girilir, net otomatik hesaplanır.</span>
      </div>
    </motion.div>
  );
}
