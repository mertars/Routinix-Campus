"use client";

import { useEffect, useRef, useState } from "react";

// Aşağı kaydırınca gizle, yukarı kaydırınca göster — sayfanın en üstündeyken
// (scroll az) her zaman görünür kalır. 'threshold' altındaki ufak titreşimler
// (momentum scroll, adres çubuğu animasyonu vb.) yanlışlıkla tetiklemesin diye var.
export function useHideOnScroll(threshold = 8) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      const diff = currentY - lastY.current;

      if (currentY < 80) {
        setHidden(false);
      } else if (Math.abs(diff) > threshold) {
        setHidden(diff > 0);
        lastY.current = currentY;
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return hidden;
}
