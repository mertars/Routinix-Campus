"use client";

import { Sparkles } from "lucide-react";
import { useInstitutionLogoUrl } from "@/lib/institution-scope";
import { cn } from "@/lib/utils";

// Üst bar kurum rozetindeki ikon (principal/student/teacher top-bar.tsx):
// kurum "Logoyu Güncelle" ekranından bir logo yüklediyse jenerik Sparkles
// yıldızı yerine kurumun KENDİ logosunu gösterir; logo yoksa eskisi gibi
// Sparkles kalır — bkz. lib/institution-scope.ts > useInstitutionLogoUrl.
export function InstitutionBadgeIcon({ className }: { className?: string }) {
  const logoUrl = useInstitutionLogoUrl();

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data: URI (base64), next/image optimize edemez
      <img src={logoUrl} alt="" className={cn("shrink-0 rounded-full object-cover", className)} />
    );
  }

  return <Sparkles className={cn("shrink-0", className)} />;
}
