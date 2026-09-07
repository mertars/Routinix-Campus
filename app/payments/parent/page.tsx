"use client";

import { PaymentsTopBar } from "@/components/payments/payments-top-bar";
import { PaymentsParentPanel } from "@/components/payments/payments-parent-panel";

// Ödeme Takip — veli görünümü. Veli hub'ı KULLANMAZ (hub sadece principal/
// teacher'a açık, bkz. middleware.ts), bu yüzden geri butonu kendi ana
// paneline (/parent) döner.
export default function PaymentsParentPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <PaymentsTopBar roleLabel="Veli" backHref="/parent" />
      <PaymentsParentPanel />
    </div>
  );
}
