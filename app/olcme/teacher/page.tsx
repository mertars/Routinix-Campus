"use client";

import { OlcmeTopBar } from "@/components/olcme/olcme-top-bar";
import { OlcmePanel } from "@/components/olcme/olcme-panel";

// Ölçme Değerlendirme — öğretmen görünümü. Bkz. /olcme/principal'daki
// AYNI gerekçe — panelde bir yetki ayrımı yok.
export default function OlcmeTeacherPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <OlcmeTopBar roleLabel="Öğretmen" />
      <OlcmePanel />
    </div>
  );
}
