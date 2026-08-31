"use client";

import { useMemo, useState } from "react";
import { User, Users, GraduationCap, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type AssignmentTarget = { type: "student"; studentId: string } | { type: "branch"; branchId: string } | { type: "grade"; grade: number };
export type RosterForTargeting = { branchId: string; branchName: string; grade: number };

function targetKey(t: AssignmentTarget): string {
  return t.type === "student" ? `student:${t.studentId}` : t.type === "branch" ? `branch:${t.branchId}` : `grade:${t.grade}`;
}

// Faz L/Z6 — Toplu atama hedef seçici: xray-assignment-section.tsx (Test 2)
// VE xray-practice-assignment-section.tsx (Test 1, hem "genel" hem
// "alt_konu") TARAFINDAN paylaşılır. Başlangıçta BİLEREK basit tutulmuştu
// (sadece seçili öğrencinin kendi şubesi/sınıfı) — kullanıcı geri
// bildirimi: "atama ekranında sadece onun sınıfı var, bütün sınıf
// seviyelerini seçebilmeli". Artık "Başka Sınıf/Şube" seçeneğiyle roster'da
// (zaten bellekte olan tam öğrenci listesi) bulunan HERHANGİ bir sınıf
// seviyesine/şubeye atama yapılabiliyor — yeni bir API gerekmedi, sunucu
// tarafı (resolveTargetStudentIds) zaten herhangi bir grade/branchId'yi
// çözebiliyordu, sadece UI kısıtlıydı.
export function XrayAssignmentTargetPicker({
  studentId,
  studentName,
  branchId,
  branchName,
  grade,
  roster,
  value,
  onChange,
}: {
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  roster: RosterForTargeting[];
  value: AssignmentTarget;
  onChange: (target: AssignmentTarget) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customGrade, setCustomGrade] = useState<number | "">("");
  const [customBranchId, setCustomBranchId] = useState("");

  const gradeOptions = useMemo(() => [...new Set(roster.map((s) => s.grade))].sort((a, b) => a - b), [roster]);
  const branchOptions = useMemo(() => {
    const scoped = customGrade === "" ? roster : roster.filter((s) => s.grade === customGrade);
    const byId = new Map(scoped.map((s) => [s.branchId, s.branchName]));
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr-TR"));
  }, [roster, customGrade]);

  const quickOptions: { target: AssignmentTarget; label: string; icon: typeof User }[] = [
    { target: { type: "student", studentId }, label: studentName, icon: User },
    { target: { type: "branch", branchId }, label: `Şube: ${branchName}`, icon: Users },
    { target: { type: "grade", grade }, label: `${grade}. Sınıfın Tamamı`, icon: GraduationCap },
  ];

  const isCustomActive = !quickOptions.some((opt) => targetKey(opt.target) === targetKey(value));

  return (
    <div className="mb-2.5 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quickOptions.map((opt) => (
          <button
            key={targetKey(opt.target)}
            type="button"
            onClick={() => {
              setCustomOpen(false);
              onChange(opt.target);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
              !customOpen && targetKey(value) === targetKey(opt.target)
                ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400/60 dark:text-sky-300"
                : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
            )}
          >
            <opt.icon className="h-3 w-3 shrink-0" />
            <span className="max-w-[140px] truncate">{opt.label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
            customOpen || isCustomActive
              ? "border-sky-500 bg-sky-500/10 text-sky-700 dark:border-sky-400/60 dark:text-sky-300"
              : "border-hairline text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/50 dark:hover:bg-white/5"
          )}
        >
          <MoreHorizontal className="h-3 w-3 shrink-0" />
          Başka Sınıf/Şube
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-cream-card p-2 dark:bg-white/5">
          <select
            value={customGrade}
            onChange={(event) => {
              const g = event.target.value === "" ? "" : Number(event.target.value);
              setCustomGrade(g);
              setCustomBranchId("");
              if (g !== "") onChange({ type: "grade", grade: g });
            }}
            className="rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            <option value="">Sınıf seç...</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}. Sınıf (tamamı)
              </option>
            ))}
          </select>
          <select
            value={customBranchId}
            onChange={(event) => {
              setCustomBranchId(event.target.value);
              if (event.target.value) onChange({ type: "branch", branchId: event.target.value });
            }}
            disabled={branchOptions.length === 0}
            className="min-w-[120px] flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            <option value="">Belirli bir şube (opsiyonel)</option>
            {branchOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
