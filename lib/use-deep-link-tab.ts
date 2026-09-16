"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// DERİN BAĞLANTI: "/principal?tab=attendance" gibi bir adres doğrudan o
// sekmeyi açar.
//
// ⚠️ NEDEN VAR (2026-09-15 denetiminde bulundu): bildirimler ve Gündem
// kartları `?tab=...` taşıyan adresler üretiyordu ama panellerin HİÇBİRİ bu
// parametreyi OKUMUYORDU — dört panel de sekmeyi `useState("overview")` ile
// sabit başlatıyordu. Sonuç: kullanıcı bildirime basıyor, panelin ana
// sekmesine düşüyor ve aradığı işi elle bulmak zorunda kalıyordu.
//
// ⚠️⚠️ İKİNCİ HATA (Mert, 2026-09-16: "video tuşu hâlâ çalışmıyor"):
// parametre YALNIZCA ilk mount'ta okunuyordu. Next.js aynı rotaya yapılan
// gezinmede (örn. /student?tab=guidance → /student?tab=videos) sayfa
// bileşenini YENİDEN KURMAZ; efekt bir daha çalışmaz ve sekme DEĞİŞMEZ.
// Canlı tarayıcıda görüldü: adres çubuğu ?tab=videos oldu ama ekran
// Rehberlik sekmesinde kaldı. Aynı hata bildirim derin bağlantılarını da
// vuruyordu — kullanıcı zaten o paneldeyse bildirime basmak hiçbir şey
// yapmıyordu.
//
// Çözüm: useSearchParams() ile adres değişimini İZLE. Bu kanca eskiden
// "statik ön-render'da Suspense ister, build'i kırabilir" diye bilerek
// kullanılmıyordu; bu dosyayı kullanan BEŞ panelin hepsi zaten
// "use client" + dinamik (oturum okuyorlar), yani statik ön-render söz
// konusu değil — `npm run build` ile doğrulandı.
export function useDeepLinkTab<T extends string>(
  defaultTab: T,
  isValidTab: (value: string) => boolean
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [tab, setTab] = useState<T>(defaultTab);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const requested = searchParams.get("tab");

  useEffect(() => {
    if (!requested || !isValidTab(requested)) return;
    setTab(requested as T);
    // Adres çubuğunu temizle: kullanıcı sekme değiştirdikten sonra sayfayı
    // yenilerse eski derin bağlantıya geri dönmesin. ⚠️ router.replace
    // DEĞİL history.replaceState — ilki yeni bir render turu başlatıp bu
    // efekti tekrar tetikleyebilir.
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    // `requested` değiştiğinde yeniden çalışır — aynı rotaya yapılan
    // gezinmelerde de sekme takip edilsin diye.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, pathname]);

  return [tab, setTab];
}
