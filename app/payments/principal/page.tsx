"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PaymentsTopBar } from "@/components/payments/payments-top-bar";
import { PaymentsPrincipalPanel } from "@/components/payments/payments-principal-panel";

// useSearchParams() bir Suspense sınırı içinde olmalı (Next.js App Router
// kuralı) — bkz. app/page.tsx'teki aynı desen.
function PanelWithTab() {
  const tab = useSearchParams().get("tab") ?? undefined;
  return <PaymentsPrincipalPanel initialTab={tab} />;
}

// Ödeme Takip — yönetici görünümü (Hub'daki 5. modül). Video/Röntgen/Ölçme
// modülleriyle AYNI ikili sayfa deseni (bkz. app/videos/principal/page.tsx).
export default function PaymentsPrincipalPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <PaymentsTopBar roleLabel="Yönetici" />
      <Suspense fallback={null}>
        <PanelWithTab />
      </Suspense>
    </div>
  );
}
