"use client";

import { PaymentsTopBar } from "@/components/payments/payments-top-bar";
import { PaymentsPrincipalPanel } from "@/components/payments/payments-principal-panel";

// Ödeme Takip — yönetici görünümü (Hub'daki 5. modül). Video/Röntgen/Ölçme
// modülleriyle AYNI ikili sayfa deseni (bkz. app/videos/principal/page.tsx).
export default function PaymentsPrincipalPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <PaymentsTopBar roleLabel="Yönetici" />
      <PaymentsPrincipalPanel />
    </div>
  );
}
