"use client";

import { useEffect, useState } from "react";

// Modal/popover gibi bileşenler her zaman kullanıcı etkileşimiyle (isOpen=false
// başlangıç) açıldığından, ilk client render'da 'false' varsayımı bir
// hydration uyuşmazlığı yaratmaz — efekt çalışana kadar hiçbir şey render
// edilmiyor zaten.
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
