"use client";

import { VideoTopBar } from "@/components/video-portal/video-top-bar";
import { VideoPortalPanel } from "@/components/video-portal/video-portal-panel";

// Video Ders Merkezi — öğretmen görünümü. Yöneticiden farkı SADECE
// `canManage=false` (video ekleme/atama butonları gizli, sadece izleme) —
// bkz. /videos/principal'daki AYNI ikili sayfa deseni.
export default function VideoTeacherPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <VideoTopBar roleLabel="Öğretmen" />
      <VideoPortalPanel canManage={false} />
    </div>
  );
}
