"use client";

import { TeacherStudentCardSheet } from "@/components/teacher/student-card-sheet";
import { useTeacherStudentCard } from "@/lib/teacher-student-card-store";

// Kartın TEK mount noktası — app/teacher/page.tsx kökünde durur.
// Depodan okur, böylece her sekme tek satırla kartı açabilir.
export function TeacherStudentCardMount() {
  const { studentId, close } = useTeacherStudentCard();
  return <TeacherStudentCardSheet studentId={studentId} onClose={close} />;
}
