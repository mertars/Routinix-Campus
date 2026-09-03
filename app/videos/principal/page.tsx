"use client";

import { VideoTopBar } from "@/components/video-portal/video-top-bar";
import { VideoPortalPanel } from "@/components/video-portal/video-portal-panel";

// Video Ders Merkezi — yönetici görünümü (Hub'daki 4. modül). Öğretmenden
// (bkz. /videos/teacher) farkı SADECE `canManage` — video ekleme burada
// açık, öğretmen tarafında sadece izleme/atama var (bkz. panel'in kendi
// gerekçesi). Röntgen'deki AYNI principal/teacher ikili sayfa deseni.
export default function VideoPrincipalPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <VideoTopBar roleLabel="Yönetici" />
      <VideoPortalPanel canManage />
    </div>
  );
}
