"use client";

import { GuidanceTopBar } from "@/components/guidance/guidance-top-bar";
import { ReferralQueue } from "@/components/guidance/referral-queue";

// Rehberlik personasının paneli — kendi girişi, kendi rolü (bkz.
// lib/server/auth/jwt.ts > AuthRole.GUIDANCE), Öğretmen'in 13 sekmelik ERP
// kabuğunun YERİNE tek amaçlı, tek sayfalık bir kabuk. v1 kapsamı BİLEREK
// tek ekran (Sevk Kuyruğu) — birden fazla sekme gerektiğinde teacher/page.
// tsx'teki "kendi kendini tanımlayan TABS dizisi" deseni buraya da taşınır.
export default function GuidancePage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <GuidanceTopBar />
      <ReferralQueue />
    </div>
  );
}
