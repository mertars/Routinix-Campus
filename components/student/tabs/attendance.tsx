"use client";

import { useCallback } from "react";
import { AttendanceCalendar } from "@/components/shared/attendance-calendar";

// ÖĞRENCİNİN KENDİ DEVAMSIZLIĞI.
//
// ⚠️ 2026-09-15 denetiminin bulgusu: devamsızlık velinin ve yöneticinin
// ekranında vardı ama öğrencinin kendisinde YOKTU — karnedeki tek bir
// yüzde dışında hiçbir izi yoktu. Oysa devamsızlık öğrencinin kendi
// davranışının sonucu; en çok onun görmesi gerekir.
//
// Ekran veliyle AYNI bileşen (components/shared/attendance-calendar.tsx),
// yalnızca veri kaynağı farklı: burada id parametresi yok, oturumdan gelir.
export function StudentAttendanceTab() {
  const endpoint = useCallback((month: string) => `/api/student/attendance?month=${month}`, []);
  return (
    <AttendanceCalendar
      endpoint={endpoint}
      absentTitle={(n) => `Bu ay ${n} gün derse gelmedin`}
    />
  );
}
