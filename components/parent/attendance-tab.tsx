"use client";

import { useCallback } from "react";
import { AttendanceCalendar } from "@/components/shared/attendance-calendar";

// Veli tarafı — ortak takvimi kendi ucuna bağlar
// (bkz. components/shared/attendance-calendar.tsx).
export function ParentAttendanceTab({ studentId }: { studentId: string }) {
  const endpoint = useCallback(
    (month: string) => `/api/parent/attendance/${studentId}?month=${month}`,
    [studentId]
  );
  return (
    <AttendanceCalendar
      endpoint={endpoint}
      absentTitle={(n) => `Bu ay ${n} gün devamsızlık var`}
    />
  );
}
