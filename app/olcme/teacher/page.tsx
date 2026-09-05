"use client";

import { useState } from "react";
import { OlcmeTopBar } from "@/components/olcme/olcme-top-bar";
import { OlcmePanel } from "@/components/olcme/olcme-panel";
import { OlcmeAnalyticsPanel } from "@/components/olcme/olcme-analytics-panel";

// Ölçme Değerlendirme — öğretmen görünümü. Bkz. /olcme/principal'daki
// AYNI gerekçe — panelde bir yetki ayrımı yok, state de AYNI şekilde
// sayfa düzeyinde.
export default function OlcmeTeacherPage() {
  const [examId, setExamId] = useState("");
  const [analytics, setAnalytics] = useState(false);

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <OlcmeTopBar
        roleLabel="Öğretmen"
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
