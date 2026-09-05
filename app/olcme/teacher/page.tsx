"use client";

import { useState } from "react";
import { OlcmeTopBar } from "@/components/olcme/olcme-top-bar";
import { OlcmePanel } from "@/components/olcme/olcme-panel";

// Ölçme Değerlendirme — öğretmen görünümü. Bkz. /olcme/principal'daki
// AYNI gerekçe — panelde bir yetki ayrımı yok, examId de AYNI şekilde
// sayfa düzeyinde (bkz. o dosyadaki açıklama).
export default function OlcmeTeacherPage() {
  const [examId, setExamId] = useState("");
  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <OlcmeTopBar roleLabel="Öğretmen" onSelectExam={setExamId} />
      <OlcmePanel examId={examId} onSelectExam={setExamId} />
    </div>
  );
}
