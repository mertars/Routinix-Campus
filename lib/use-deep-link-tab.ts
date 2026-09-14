"use client";

import { useEffect, useState } from "react";

// DERİN BAĞLANTI: "/principal?tab=attendance" gibi bir adres doğrudan o
// sekmeyi açar.
//
// ⚠️ NEDEN VAR (2026-09-15 denetiminde bulundu): bildirimler ve Gündem
// kartları `?tab=...` taşıyan adresler üretiyordu ama panellerin HİÇBİRİ bu
// parametreyi OKUMUYORDU — dört panel de sekmeyi `useState("overview")` ile
// sabit başlatıyordu. Sonuç: kullanıcı bildirime basıyor, panelin ana
// sekmesine düşüyor ve aradığı işi elle bulmak zorunda kalıyordu. Yani
// "bildirime basarak işini yap" akışı hiç çalışmıyordu.
//
// ⚠️ `useSearchParams()` KULLANILMIYOR: Next'in App Router'ında o kanca
// statik ön-render sırasında Suspense sınırı istiyor ve build'i kırabiliyor.
// Burada tek seferlik bir okuma yeterli olduğu için adres doğrudan
// `window.location`dan okunuyor — sunucuda hiç çalışmaz, ilk render'dan
// sonra devreye girer.
export function useDeepLinkTab<T extends string>(
  defaultTab: T,
  isValidTab: (value: string) => boolean
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [tab, setTab] = useState<T>(defaultTab);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && isValidTab(requested)) {
      setTab(requested as T);
      // Adres çubuğunu temizle: kullanıcı sekme değiştirdikten sonra
      // sayfayı yenilerse eski derin bağlantıya geri dönmesin.
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    // Yalnızca ilk mount'ta — sonradan sekme değişimlerini ezmemeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [tab, setTab];
}
