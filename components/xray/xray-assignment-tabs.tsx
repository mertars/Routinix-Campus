"use client";

import { useState } from "react";
import { ClipboardCheck, BookOpen, ListFilter, ClipboardList } from "lucide-react";
import { XrayPlacementAssignButton } from "@/components/xray/xray-placement-assign-button";
import { XrayPracticeAssignmentSection } from "@/components/xray/xray-practice-assignment-section";
import { XrayAssignmentSection } from "@/components/xray/xray-assignment-section";
import type { XrayRosterStudent } from "@/components/xray/xray-results-panel";
import { cn } from "@/lib/utils";

type Tab = "yerlestirme" | "genel" | "alt_konu" | "yeterlilik";

const TABS: { key: Tab; label: string; icon: typeof ClipboardCheck }[] = [
  { key: "yerlestirme", label: "Seviye Belirleme", icon: ClipboardCheck },
  { key: "genel", label: "Genel Konu", icon: BookOpen },
  { key: "alt_konu", label: "Alt Konu", icon: ListFilter },
  { key: "yeterlilik", label: "Ne Kadar Anlamış", icon: ClipboardList },
];

// Faz "menü düzenlemesi" — eskiden bu 4 atama paneli (Seviye Belirleme +
// Genel Konu + Alt Konu + Ne Kadar Anlamış) HER ZAMAN aynı anda, alt alta
// render ediliyordu — sağ sütun çok uzuyordu. Artık sekmeli: SADECE seçili
// sekmenin bileşeni render edilir. Alttaki bileşenler (XrayPlacement
// AssignButton/XrayPracticeAssignmentSection/XrayAssignmentSection) ve
// onlara geçirilen props HİÇ DEĞİŞMEDİ — sadece HANGİSİNİN göründüğü
// kontrol ediliyor.
export function XrayAssignmentTabs({
  studentId,
  studentName,
  branchId,
  branchName,
  grade,
  subject,
  roster,
}: {
  studentId: string;
  studentName: string;
  branchId: string;
  branchName: string;
  grade: number;
  subject: string;
  roster: XrayRosterStudent[];
}) {
  const [active, setActive] = useState<Tab>("yerlestirme");

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-medium transition",
              active === tab.key ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream" : "text-espresso-muted hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
            )}
          >
            <tab.icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}
      </div>

      {active === "yerlestirme" && <XrayPlacementAssignButton roster={roster} subject={subject} />}
      {active === "genel" && (
        <XrayPracticeAssignmentSection studentId={studentId} studentName={studentName} branchId={branchId} branchName={branchName} grade={grade} subject={subject} variant="genel" roster={roster} />
      )}
      {active === "alt_konu" && (
        <XrayPracticeAssignmentSection studentId={studentId} studentName={studentName} branchId={branchId} branchName={branchName} grade={grade} subject={subject} variant="alt_konu" roster={roster} />
      )}
      {active === "yeterlilik" && <XrayAssignmentSection studentId={studentId} studentName={studentName} branchId={branchId} branchName={branchName} grade={grade} subject={subject} roster={roster} />}
    </div>
  );
}
