"use client";

import { Space_Grotesk } from "next/font/google";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

// Routinix marka kimliğinin paylaşılan görsel parçaları — "dış ekranlar"
// (rol seçimi + login) VE 4 iş paneli (Principal/Teacher/Student/Parent)
// AYNI ısı paletini kullanır: turuncu ana renk, kahverengi/espresso zemin,
// altın ve bordo YAN renkler (soğuk mor/mavi YOK — "kurumsal ama sıcak"
// kimliği bozmasın diye bilerek tek bir renk ailesinde kalınır).
export const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"] });

export const BRAND_HEX = {
  orange: "#FF6B00",
  amber: "#FF8C00",
  gold: "#D8A13B", // yan renk — madalya/prestij vurgusu
  wine: "#8C3A2B", // yan renk — derin bordo/toprak tonu, asla ana vurguyla yarışmaz
} as const;

// Yavaşça süzülen, "nefes alan" mesh-gradient küreleri — dış ekranlar için.
// Boyut/blur PanelAurora ile AYNI performans gerekçesiyle küçültüldü (bkz.
// oradaki not) — giriş/rol-seçim ekranları da dahil, tüm sürekli-animasyonlu
// arka planlar aynı standarda çekildi.
export function AuroraOrbs() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-28 -top-20 h-[23rem] w-[23rem] rounded-full bg-[#FF6B00]/30 blur-[64px] mix-blend-screen"
        style={AURORA_BLOB_WILL_CHANGE}
        animate={reduceMotion ? undefined : { x: [0, 42, -14, 0], y: [0, 28, -20, 0], scale: [1, 1.06, 0.97, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 top-1/3 h-[20rem] w-[20rem] rounded-full bg-[#8C3A2B]/30 blur-[64px] mix-blend-screen"
        style={AURORA_BLOB_WILL_CHANGE}
        animate={reduceMotion ? undefined : { x: [0, -35, 20, 0], y: [0, -24, 18, 0], scale: [1, 0.96, 1.04, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-28 left-1/4 h-[19rem] w-[19rem] rounded-full bg-[#D8A13B]/25 blur-[58px] mix-blend-screen"
        style={AURORA_BLOB_WILL_CHANGE}
        animate={reduceMotion ? undefined : { x: [0, 28, -28, 0], y: [0, -14, 20, 0] }}
        transition={{ duration: 19, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

// "R" logosunun etrafında dönen ışık halkası — CSS conic-gradient border-sweep.
// innerClassName ile hem sabit-koyu (login/rol seçimi) hem tema-duyarlı
// (light/dark paneller) kullanımlara uyar.
export function GlowLogo({
  size = "h-10 w-10",
  textSize = "text-lg",
  innerClassName = "bg-[#08060B]",
}: {
  size?: string;
  textSize?: string;
  innerClassName?: string;
}) {
  return (
    <div className={cn("relative shrink-0", size)}>
      <div
        className="absolute inset-0 animate-[spin_4s_linear_infinite] rounded-xl"
        style={{ background: "conic-gradient(from 0deg, transparent 0%, #FF8C00 14%, #D8A13B 22%, transparent 34%)" }}
      />
      <div className={cn("absolute inset-[2px] flex items-center justify-center rounded-[10px]", innerClassName)}>
        <span className={cn(spaceGrotesk.className, textSize, "font-bold text-[#FFA347]")}>R</span>
      </div>
    </div>
  );
}

export const AURORA_GRID_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(255,140,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,140,0,0.03) 1px, transparent 1px)",
  backgroundSize: "56px 56px",
};

// PERFORMANS: h-[38rem]/blur-[130px] gibi büyük+bulanık+sürekli hareketli
// katmanlar (bkz. PanelAurora altta) cihaz GPU/CPU'sunu sürekli meşgul
// ediyordu — özellikle koyu temada, TÜM panellerde AYNI ANDA açık kalan bu
// bileşen + üstündeki onlarca kartın backdrop-blur'ı bileşince mobilde
// gözle görülür ısınma/kasmaya yol açıyordu (kullanıcı geri bildirimi).
// Boyut/blur yarıçapı burada BİLEREK küçültüldü — "köşelerde yumuşak parlama"
// karakteri korunuyor, sadece her karede yeniden hesaplanan piksel alanı
// çok daha küçük.
const AURORA_BLOB_WILL_CHANGE = { willChange: "transform" } as const;

// İnce bir film-grain dokusu — düz, "temiz vektör" hissini kırıp saten/kağıt
// gibi maddesel bir derinlik katar (premium dashboard'ların klasik hilesi).
// Saf CSS/SVG, ek bir asset indirmez.
const GRAIN_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
};

// Paneller (Principal/Teacher/Student/Parent) için AYNI aurora kimliğinin
// "gün boyu kullanılan iş ekranı" versiyonu — layout.tsx'te TEK sefer,
// <body>'nin arkasına sabit (fixed) olarak monte edilir. Sadece dark modda
// görünür. İki köşede (sol-üst turuncu, sağ-alt bordo/altın) ayrı ışık
// kümeleri olduğu için ekranın SADECE bir köşesi değil, genel yüzeyi canlı
// hisseder; üstüne çok hafif bir grain dokusu düz/steril görünümü kırar.
//
// RENK: Sabit hex DEĞİL, ':root'taki '--brand-{ton}' CSS değişkenlerinden
// (bkz. lib/accent-context.tsx > AccentProvider, tailwind.config.ts >
// withOpacity) okunur — kullanıcı sağ üstteki Tema/Vurgu Rengi seçiciden
// yeni bir renk seçtiğinde bu değişkenler runtime'da güncellenir ve aurora
// bloblarının TAMAMI (farklı tonlarda: 600/400/800/500) yeni rengin
// ailesine döner. Varsayılan turuncu (#FF6B00) tam olarak eski sabit
// değerlerle aynı görünümü üretir — bu bir davranış değişikliği değil,
// sadece sabit rengi CSS değişkenine bağlamaktır.
export function PanelAurora() {
  // Cihazın/OS'un "hareketi azalt" tercihine saygı — hem erişilebilirlik
  // hem de bu tercihi AÇIK olan kullanıcılar genelde tam bu tür sürekli
  // animasyonlardan rahatsız olan/performans sorunu yaşayan cihazlardadır.
  // true ise blob'lar TAMAMEN durur, sadece sabit bir yumuşak parlama kalır
  // (blur/mix-blend maliyeti tek seferlik paint'e düşer, per-frame olmaz).
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden dark:block">
      <div className="absolute inset-0 bg-midnight" />

      <motion.div
        className="absolute -left-32 -top-24 h-[26rem] w-[26rem] rounded-full blur-[70px] mix-blend-screen"
        style={{ backgroundColor: "rgb(var(--brand-600) / 0.25)", ...AURORA_BLOB_WILL_CHANGE }}
        animate={reduceMotion ? undefined : { x: [0, 40, -15, 0], y: [0, 25, -18, 0], scale: [1, 1.06, 0.97, 1] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-28 -top-16 h-[19rem] w-[19rem] rounded-full blur-[64px] mix-blend-screen"
        style={{ backgroundColor: "rgb(var(--brand-400) / 0.16)", ...AURORA_BLOB_WILL_CHANGE }}
        animate={reduceMotion ? undefined : { x: [0, -25, 15, 0], y: [0, 22, -10, 0] }}
        transition={{ duration: 31, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 bottom-0 h-[23rem] w-[23rem] rounded-full blur-[70px] mix-blend-screen"
        style={{ backgroundColor: "rgb(var(--brand-800) / 0.22)", ...AURORA_BLOB_WILL_CHANGE }}
        animate={reduceMotion ? undefined : { x: [0, -28, 18, 0], y: [0, -22, 15, 0], scale: [1, 0.96, 1.04, 1] }}
        transition={{ duration: 33, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -bottom-32 left-1/4 h-[23rem] w-[23rem] rounded-full blur-[64px] mix-blend-screen"
        style={{ backgroundColor: "rgb(var(--brand-500) / 0.20)", ...AURORA_BLOB_WILL_CHANGE }}
        animate={reduceMotion ? undefined : { x: [0, 25, -25, 0], y: [0, -18, 18, 0] }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(ellipse 80% 50% at 50% -10%, rgb(var(--brand-600) / 0.18), transparent 60%)",
        }}
      />
      <div className="absolute inset-0 opacity-[0.5]" style={AURORA_GRID_STYLE} />
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay" style={GRAIN_STYLE} />
    </div>
  );
}
