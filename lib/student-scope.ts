"use client";

import { useEffect, useState } from "react";
import { useRole } from "./role-context";
import { useLocalStorageState } from "./use-local-storage-state";
import { type BranchSegment, type GradeLevel } from "./mock-data";

// Öğrenci paneli tek bir demo öğrenci (Arslan Yıldırım, Student.id "1")
// üzerinden çalışıyor — gerçek bir login/oturum yok, bkz. prisma/seed.ts.
// Sınıf-duyarlı iş kuralını (LGS/YKS/Genel akışları) TÜM yollarıyla
// gösterebilmek için burada yalnızca arayüz amaçlı bir "demo sınıf" seçici
// tutuyoruz — gerçek net/devam/branş verisi her zaman aynı öğrenciden
// (Postgres'ten) gelir, sadece grade/segment (ve buna bağlı sınav geri
// sayımı/tercih robotu) değişir.
export type AcademicTrack = "lgs" | "yks" | "genel";

export type DemoGradeChoice = {
  key: string;
  label: string;
  grade?: GradeLevel;
  segment: BranchSegment;
};

export const DEMO_GRADE_CHOICES: DemoGradeChoice[] = [
  { key: "grade8", label: "8. Sınıf · LGS Adayı", grade: 8, segment: "LGS" },
  { key: "grade10", label: "10. Sınıf · Genel Akademik", grade: 10, segment: "YKS" },
  { key: "grade12", label: "12. Sınıf · YKS Adayı", grade: 12, segment: "YKS" },
  { key: "mezun", label: "Mezun · YKS Adayı", grade: undefined, segment: "MEZUN" },
];

const DEMO_GRADE_KEY = "routinix-kampus-student-demo-grade";
const STUDENT_ID = "1";

export function trackFromGrade(grade: GradeLevel | undefined): AcademicTrack {
  if (grade === 8) return "lgs";
  if (grade === 11 || grade === 12 || grade === undefined) return "yks";
  return "genel";
}

export type StudentReport = {
  id: string;
  name: string;
  branch: string;
  branchId: string;
  actualNet: number;
  targetNet: number;
  attendanceRate: number;
};

const EMPTY_REPORT: StudentReport = { id: STUDENT_ID, name: "Arslan", branch: "", branchId: "", actualNet: 0, targetNet: 0, attendanceRate: 0 };

export function useStudentScope() {
  const { persona } = useRole();
  const studentName = persona?.name ?? "Arslan";

  const [report, setReport] = useState<StudentReport>(EMPTY_REPORT);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/students/${encodeURIComponent(STUDENT_ID)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || data.error) return;
        setReport({
          id: data.id,
          name: `${data.firstName} ${data.lastName}`,
          branch: data.branchName,
          branchId: data.branchId,
          actualNet: data.actualNet ?? 0,
          targetNet: data.targetNet ?? 0,
          attendanceRate: data.attendanceRate ?? 0,
        });
      })
      .catch(() => {
        // sessiz — boş rapor gösterilir
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [demoGradeKey, setDemoGradeKey] = useLocalStorageState<string>(DEMO_GRADE_KEY, "grade12");
  const demoChoice = DEMO_GRADE_CHOICES.find((choice) => choice.key === demoGradeKey) ?? DEMO_GRADE_CHOICES[2];

  const grade = demoChoice.grade;
  const segment = demoChoice.segment;
  const track = trackFromGrade(grade);

  return {
    studentId: STUDENT_ID,
    studentName,
    branchName: report.branch,
    branchId: report.branchId,
    report,
    grade,
    segment,
    track,
    demoGradeKey,
    setDemoGradeKey,
  };
}
