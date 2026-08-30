"use client";

import { XrayTopBar } from "@/components/xray/xray-top-bar";
import { XrayRoadmapHero } from "@/components/xray/xray-roadmap-hero";

export default function XrayPrincipalPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <XrayTopBar roleLabel="Yönetici" />
      <XrayRoadmapHero intro="Kurum genelinde öğrenci bazlı derin performans ve konu analizi merkezi burada olacak. Şu an temel altyapı hazır, röntgen ekranları sırayla açılıyor." />
    </div>
  );
}
