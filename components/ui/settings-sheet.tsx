"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, RotateCcw, Palette, LogOut, type LucideIcon } from "lucide-react";
import { useAccent } from "@/lib/accent-context";
import { ACCENT_PRESETS, DEFAULT_ACCENT_HEX } from "@/lib/color-utils";
import { useLogout } from "@/lib/role-context";
import { useInstitutionName } from "@/lib/institution-scope";
import { ThemeToggle } from "@/components/theme-toggle";
import { InstitutionBadgeIcon } from "@/components/ui/institution-badge-icon";

// ----------------------------------------------------------------------------
// TÜM panellerin ortak "Ayarlar" sayfası — vurgu rengi, tema, kimlik, çıkış.
//
// ⚠️ NEDEN TEK BİLEŞEN (2026-09-15, Mert iki ayrı şikâyetle bildirdi):
//
// 1. "telefonda renk paleti hâlâ ekranın üstünden taşıyor, bunu uzun zaman
//    önce düzeltmiştik yine çıkmış" — çünkü düzeltme yalnızca YÖNETİCİ
//    panelinde yapılmıştı (mobile-menu-popup.tsx alttan açılan sayfaya
//    çevrildi), öğrenci ve öğretmen popup'ları ESKİ desende kaldı: ekran
//    ortasına sabitlenmiş (top-1/2 -translate-y-1/2), max-height'ı ve
//    kaydırması olmayan bir kart. İçerik uzayınca üstten taşıp kırpılıyordu.
//    Aynı düzeltmeyi üç ayrı dosyada tekrarlamak, üçüncü kez geri gelmesi
//    demekti — bu yüzden artık TEK bir bileşen var.
//
// 2. "çıkış yap butonunu ayarlar menüsüne koy, üst panel telefonda çok
//    kalabalık, çıkış yap her gün basılacak bir buton değil, dershane ismi
//    tam gözüksün" — çıkış artık üst bardan alınıp buraya konuldu; üst
//    barda açılan yer kurum adına verildi.
//
// Düzen: alttan açılan sayfa (drag ile kapanır, safe-area dolgusu, max-h +
// iç kaydırma).
//
// ⚠️⚠️ PORTAL ŞART — taşmanın GERÇEK kök nedeni buydu (canlı ölçümle
// bulundu: öğretmen/öğrenci panelinde panel ekranın 479px ÜSTÜNDE
// konumlanıyordu). CSS kuralı: `transform` uygulanmış bir ata varsa,
// `position: fixed` çocuk artık VIEWPORT'a değil O ATAYA çapalanır. Öğretmen
// ve öğrenci üst barları `motion.header` ve kaydırınca gizlenmek için
// `animate={{ y: ... }}` (yani transform) kullanıyor — panel de o header'ın
// İÇİNDE render ediliyordu, dolayısıyla header'ın kutusuna yapışıp ekranın
// dışına taşıyordu. Yönetici panelinde sorun YOKTU çünkü orada popup
// header'ın DIŞINDA, kardeş olarak duruyordu.
//
// Portal, paneli her koşulda doğrudan document.body'ye taşır — bu bileşen
// NEREDE render edilirse edilsin bir daha bu tuzağa düşemez. Sebep "nereye
// koyduğuna dikkat et" disiplinine bırakılırsa üçüncü kez geri gelir.
// ----------------------------------------------------------------------------

export function SettingsSheet({
  isOpen,
  onClose,
  title = "Ayarlar",
  subtitleIcon: SubtitleIcon,
  subtitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitleIcon?: LucideIcon;
  /** Kimliğin altında gösterilecek bağlam (şube, branş) — panele göre değişir. */
  subtitle?: string;
}) {
  const { hex, setAccent, resetAccent } = useAccent();
  const logout = useLogout();
  const institutionName = useInstitutionName();
  const isDefaultAccent = hex.toLowerCase() === DEFAULT_ACCENT_HEX.toLowerCase();

  // document.body sunucuda yok — portal yalnızca mount olduktan sonra kurulur.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-espresso/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 500) onClose();
            }}
            className="fixed inset-x-0 bottom-0 z-[80] flex max-h-[88vh] w-full flex-col rounded-t-3xl border-t border-white/10 bg-midnight-card/95 text-cream shadow-2xl backdrop-blur-2xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex shrink-0 justify-center pt-2.5">
              <span className="h-1.5 w-10 rounded-full bg-white/20" />
            </div>

            {/* min-h-0 + overflow-y-auto: içerik ne kadar uzarsa uzasın
                sayfa DIŞINA taşmaz, kendi içinde kayar. */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-3">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-cream">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Ayarları kapat"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-cream/60 transition hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Kurum kimliği — üst barda yer açabilmek için tam adı burada
                  KIRPILMADAN göster (mobil üst barda "Kont…" oluyordu). */}
              {institutionName && (
                <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cream/40">
                    <InstitutionBadgeIcon className="h-3.5 w-3.5" /> Kurum
                  </p>
                  <p className="mt-1 text-sm font-semibold text-cream">{institutionName}</p>
                  {subtitle && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-cream/50">
                      {SubtitleIcon && <SubtitleIcon className="h-3.5 w-3.5" />} {subtitle}
                    </p>
                  )}
                </div>
              )}

              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-cream/50">
                <Palette className="h-3.5 w-3.5" /> Vurgu Rengi
              </p>
              <div className="mb-3 grid grid-cols-5 gap-2">
                {ACCENT_PRESETS.map((preset) => {
                  const isActive = preset.hex.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={preset.hex}
                      onClick={() => setAccent(preset.hex)}
                      title={preset.label}
                      aria-label={preset.label}
                      className="relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition"
                      style={{ backgroundColor: preset.hex, borderColor: isActive ? preset.hex : "transparent" }}
                    >
                      {isActive && (
                        <span className="flex h-full w-full items-center justify-center rounded-full bg-black/20">
                          <Check className="h-4 w-4 text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <label className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 px-2.5 py-2.5">
                <input
                  type="color"
                  value={hex}
                  onChange={(event) => setAccent(event.target.value)}
                  aria-label="Özel renk seç"
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 bg-transparent p-0"
                />
                <span className="text-xs text-cream/50">Özel Renk Seç</span>
                <span className="ml-auto font-mono text-[11px] uppercase text-cream">{hex}</span>
              </label>
              <button
                onClick={resetAccent}
                disabled={isDefaultAccent}
                className="mb-6 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/15 px-3 py-2.5 text-xs font-medium text-cream/60 transition hover:bg-white/5 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Varsayılana Dön
              </button>

              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-cream/50">Tema</p>
              <div className="mb-6 flex items-center justify-between rounded-xl border border-white/15 px-3.5 py-2.5">
                <span className="text-xs text-cream/70">Gece / Gündüz Modu</span>
                <ThemeToggle />
              </div>

              {/* Çıkış EN ALTTA ve tek başına — günlük bir işlem değil,
                  üst barda sürekli göz önünde durması gereksizdi. */}
              <button
                onClick={() => {
                  onClose();
                  logout();
                }}
                className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
              >
                <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
