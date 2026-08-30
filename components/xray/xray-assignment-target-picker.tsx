"use client";

import { User, Users, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignmentTarget = { type: "student"; studentId: string } | { type: "branch"; branchId: string } | { type: "grade"; grade: number };

// Faz L — Toplu atama hedef seçici: xray-assignment-section.tsx (Test 2) VE
// xray-practice-assignment-section.tsx (Test 1) TARAFINDAN paylaşılır.
// Ayrı bir öğrenci/şube/sınıf ARAMA ekranı KURMAK yerine BİLEREK basit
// tutuldu — zaten panelde SEÇİLİ olan öğrencinin şubesi/sınıf seviyesi
// üzerinden 3 seçenek sunuyor (tek öğrenci / onun şubesi / onun sınıf
// seviyesi), çünkü yönetici zaten o öğrenciyi görüntülerken atama yapıyor.
export function XrayAssignmentTargetPicker({
  studentName,
  branchName,
  grade,
  value,
  onChange,
}: {
  studentName: string;
  branchName: string;
  grade: number;
  value: AssignmentTarget["type"];
  onChange: (type: AssignmentTarget["type"]) => void;
}) {
  const options: { type: AssignmentTarget["type"]; label: string; icon: typeof User }[] = [
    { type: "student", label: studentName, icon: User },
    { type: "branch", label: `Şube: ${branchName}`, icon: Users },
    { type: "grade", label: `${grade}. Sınıfın Tamamı`, icon: GraduationCap },
  ];

  return (
    <div className="mb-2.5 flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onChange(opt.type)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
            value === opt.type
              ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400/60 dark:text-sky-300"
              : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
          )}
        >
          <opt.icon className="h-3 w-3 shrink-0" />
          <span className="max-w-[140px] truncate">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
