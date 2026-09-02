"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, BookOpen, ListFilter, ClipboardList } from "lucide-react";
import { XrayPlacementAssignButton } from "@/components/xray/xray-placement-assign-button";
import { XrayPracticeAssignmentSection } from "@/components/xray/xray-practice-assignment-section";
import { XrayAssignmentSection } from "@/components/xray/xray-assignment-section";
import type { XrayRosterStudent } from "@/components/xray/xray-results-panel";
import { cn } from "@/lib/utils";

type Tab = "yerlestirme" | "genel" | "alt_konu" | "yeterlilik";

// Kullanıcı geri bildirimi — 4 sekmenin logosu/yazısı kendi renginde olsun,
// seçili sekme "fosforlu kalem" gibi YUMUŞAK ama KESİN bir vurguyla belli
// olsun. Her sekmenin sabit bir tonu var (seçili DEĞİLKEN de ikon o tonda
// kalır, sadece soluk) — seçilince aynı ton dolar + highlighter'ın kendisi
// (layoutId ile) sekmeler arası kayarak taşınır.
const TABS: { key: Tab; label: string; icon: typeof ClipboardCheck; tone: string; highlight: string; underline: string }[] = [
  { key: "yerlestirme", label: "Seviye Belirleme", icon: ClipboardCheck, tone: "text-sky-600 dark:text-sky-400", highlight: "bg-sky-400/15 dark:bg-sky-400/10", underline: "bg-sky-500" },
  { key: "genel", label: "Genel Konu", icon: BookOpen, tone: "text-emerald-600 dark:text-emerald-400", highlight: "bg-emerald-400/15 dark:bg-emerald-400/10", underline: "bg-emerald-500" },
  { key: "alt_konu", label: "Alt Konu", icon: ListFilter, tone: "text-amber-600 dark:text-amber-400", highlight: "bg-amber-400/15 dark:bg-amber-400/10", underline: "bg-amber-500" },
  { key: "yeterlilik", label: "Ne Kadar Anlamış", icon: ClipboardList, tone: "text-violet-600 dark:text-violet-400", highlight: "bg-violet-400/15 dark:bg-violet-400/10", underline: "bg-violet-500" },
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
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className="relative flex items-center justify-center gap-1.5 overflow-hidden rounded-lg px-2 py-2 text-[11px] font-medium transition"
            >
              {isActive && (
                <motion.span
                  layoutId="assignment-tab-highlight"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className={cn("absolute inset-0 rounded-lg", tab.highlight)}
                >
                  <span className={cn("absolute inset-x-2 bottom-0 h-[2px] rounded-full", tab.underline)} />
                </motion.span>
              )}
              <span className={cn("relative z-10 flex items-center gap-1.5", isActive ? tab.tone : "text-espresso-muted/70 dark:text-cream/30")}>
                <tab.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </span>
            </button>
          );
        })}
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
