"use client";

import { XrayTopBar } from "@/components/xray/xray-top-bar";
import { XrayRoadmapHero } from "@/components/xray/xray-roadmap-hero";

export default function XrayTeacherPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <XrayTopBar roleLabel="Öğretmen" />
      <XrayRoadmapHero intro="Öğrencilerini konu konu değerlendirip gerçek bir röntgen çekeceğin ekran burada olacak. Şu an temel altyapı hazır, sırada 'Röntgen Çek' ekranı var." />
    </div>
  );
}
