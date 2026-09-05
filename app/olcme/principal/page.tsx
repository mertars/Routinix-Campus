"use client";

import { useState } from "react";
import { OlcmeTopBar } from "@/components/olcme/olcme-top-bar";
import { OlcmePanel } from "@/components/olcme/olcme-panel";

// Ölçme Değerlendirme — yönetici görünümü (Hub'daki 3. modül). Backend
// uçları (bkz. app/api/exams/**) teacher+principal'i EŞİT yetkiyle kabul
// ediyor (bir branş öğretmeni kendi dersinin cevap anahtarını yönetici
// kadar rahat girebilmeli) — bu yüzden Video Ders Merkezi'ndeki
// canManage ayrımı BURADA yok, iki sayfa da AYNI paneli render ediyor.
// examId burada (sayfa düzeyinde) tutuluyor çünkü hem üst bardaki
// "Geçmiş Denemeler" seçici hem de OlcmePanel bu duruma ihtiyaç duyuyor
// — iki bileşen kardeş, birbirlerine doğrudan erişemiyor.
export default function OlcmePrincipalPage() {
  const [examId, setExamId] = useState("");
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <OlcmeTopBar roleLabel="Yönetici" onSelectExam={setExamId} />
      <OlcmePanel examId={examId} onSelectExam={setExamId} />
    </div>
  );
}
