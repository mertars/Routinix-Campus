"use client";

import { OlcmeTopBar } from "@/components/olcme/olcme-top-bar";
import { OlcmePanel } from "@/components/olcme/olcme-panel";

// Ölçme Değerlendirme — yönetici görünümü (Hub'daki 3. modül). Backend
// uçları (bkz. app/api/exams/**) teacher+principal'i EŞİT yetkiyle kabul
// ediyor (bir branş öğretmeni kendi dersinin cevap anahtarını yönetici
// kadar rahat girebilmeli) — bu yüzden Video Ders Merkezi'ndeki
// canManage ayrımı BURADA yok, iki sayfa da AYNI paneli render ediyor.
export default function OlcmePrincipalPage() {
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <OlcmeTopBar roleLabel="Yönetici" />
      <OlcmePanel />
    </div>
  );
}
