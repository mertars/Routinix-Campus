"use client";

import { useState } from "react";
import { OlcmeTopBar } from "@/components/olcme/olcme-top-bar";
import { OlcmePanel } from "@/components/olcme/olcme-panel";
import { OlcmeAnalyticsPanel } from "@/components/olcme/olcme-analytics-panel";

// Ölçme Değerlendirme — yönetici görünümü (Hub'daki 3. modül). Backend
// uçları (bkz. app/api/exams/**) teacher+principal'i EŞİT yetkiyle kabul
// ediyor (bir branş öğretmeni kendi dersinin cevap anahtarını yönetici
// kadar rahat girebilmeli) — bu yüzden Video Ders Merkezi'ndeki
// canManage ayrımı BURADA yok, iki sayfa da AYNI paneli render ediyor.
//
// examId ve görünüm (denemeler / analiz) sayfa düzeyinde tutuluyor çünkü
// üst bardaki "Geçmiş Denemeler" ve "Analiz" butonları da aynı state'i
// değiştiriyor — üst bar ile panel kardeş bileşenler.
export default function OlcmePrincipalPage() {
  const [examId, setExamId] = useState("");
  const [analytics, setAnalytics] = useState(false);

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <OlcmeTopBar
        roleLabel="Yönetici"
        onSelectExam={(id) => {
          setAnalytics(false);
          setExamId(id);
        }}
        onToggleAnalytics={() => setAnalytics((v) => !v)}
        analyticsActive={analytics}
      />
      {analytics ? <OlcmeAnalyticsPanel /> : <OlcmePanel examId={examId} onSelectExam={setExamId} />}
    </div>
  );
}
