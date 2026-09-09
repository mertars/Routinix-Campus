"use client";

import { useEffect, useState } from "react";
import { useLocalStorageState } from "./use-local-storage-state";
import { type BranchSegment, type GradeLevel } from "./mock-data";

// Öğrenci paneli, /api/auth/session'dan gelen GERÇEK oturum kimliğine göre
// SADECE kendi verisini gösterir (bkz. app/api/students/[id]).
//
// ⚠️ SINIF SEVİYESİ GERÇEK ŞUBEDEN GELİR.
//
// Burada eskiden seviye YALNIZCA localStorage'daki demo seçicisinden
// okunuyordu ve varsayılanı "grade12" idi. Sonuç: seçiciye hiç
// dokunmayan bir 7. sınıf öğrencisi paneli 12. sınıf YKS adayı gibi
// görüyordu — üniversite tercih robotu, YKS geri sayımı ve röntgen
// kapısı hep yanlış seviyeye göre çalışıyordu. Ölçüldü: API grade 7
// derken panel grade 12 kullanıyordu. Veli paneli aynı çocuk için
// GERÇEK seviyeyi gösterdiği için veli ile öğrenci farklı şey
// görüyordu.
//
// Demo seçici KALDIRILMADI ama artık yalnızca AÇIK BİR TERCİH olarak
// çalışır: kullanıcı bir seçim yapmadıysa gerçek seviye kullanılır.
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
  /** Öğrencinin GERÇEK sınıf seviyesi (şubesinden). */
  grade?: GradeLevel;
  segment?: BranchSegment;
};

const EMPTY_REPORT: StudentReport = { id: "", name: "", branch: "", branchId: "", actualNet: 0, targetNet: 0, attendanceRate: 0 };


// Öğrencinin panelde kullanılacak seviyesi.
//
// Saf fonksiyon: kararın kendisi testlenebilsin diye hook'tan
// ayrıldı. Kural tek cümle — AÇIK bir demo seçimi yoksa GERÇEK şube
// seviyesi kullanılır.
export function resolveStudentLevel(
  demoChoice: DemoGradeChoice | undefined,
  reportGrade: GradeLevel | undefined,
  reportSegment: BranchSegment | undefined
): { grade: GradeLevel | undefined; segment: BranchSegment } {
  if (demoChoice) return { grade: demoChoice.grade, segment: demoChoice.segment };

  // Mezun şubesinin sınıf seviyesi TEMSİLÎDİR (şemada 12 tutulur);
  // segment MEZUN ise seviye yok sayılır — sınıf atlatma kuralındaki
  // aynı ayrım.
  const grade = reportSegment === "MEZUN" ? undefined : reportGrade;
  // Segment henüz yüklenmediyse YKS varsayılır: panelin çoğu akışı
  // buna göre kurulu ve yükleme anı kısa sürer.
  return { grade, segment: reportSegment ?? "YKS" };
}

export function useStudentScope() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [report, setReport] = useState<StudentReport>(EMPTY_REPORT);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.id) return;
        setStudentId(data.id);
        setStudentName(data.name ?? "");
      })
      .catch(() => {
        // sessiz — oturum çözülemedi, kapsam boş kalır
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    fetch(`/api/students/${encodeURIComponent(studentId)}`)
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
          grade: typeof data.grade === "number" ? (data.grade as GradeLevel) : undefined,
          segment: data.segment as BranchSegment | undefined,
        });
      })
      .catch(() => {
        // sessiz — boş rapor gösterilir
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  // Varsayılan BOŞ: "seçim yapılmadı" ile "12. sınıf seçildi" ayrı
  // şeyler. Boşken gerçek şube seviyesi kullanılır.
  const [demoGradeKey, setDemoGradeKey] = useLocalStorageState<string>(DEMO_GRADE_KEY, "");
  const demoChoice = demoGradeKey ? DEMO_GRADE_CHOICES.find((choice) => choice.key === demoGradeKey) : undefined;

  const { grade, segment } = resolveStudentLevel(demoChoice, report.grade, report.segment);
  const track = trackFromGrade(grade);

  return {
    studentId,
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
