"use client";

import { useEffect, useState } from "react";
import { XrayTopBar } from "@/components/xray/xray-top-bar";
import { XrayResultsPanel, type XrayRosterStudent } from "@/components/xray/xray-results-panel";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";

// Öğretmenin röntgen görünümü — roster SADECE kendi şubeleri (bkz.
// /api/students?branchIds=, optical-scanner.tsx/gap-closing.tsx'teki AYNI
// desen), academic-xray.tsx'teki kurum geneli roster'dan BİLEREK farklı.
//
// Faz K — Akademik Röntgen ŞUANLIK SADECE lise (9-12. sınıf) için (bkz.
// /xray/principal'daki AYNI gerekçe) — öğretmenin ortaokul şubeleri varsa
// bile roster'a girmiyor.
export default function XrayTeacherPage() {
  const { subject, assignedBranches } = useTeacherScope();
  const { showError } = useToast();
  const [roster, setRoster] = useState<XrayRosterStudent[]>([]);
  const highSchoolBranches = assignedBranches.filter((b) => (b.grade ?? 0) >= 9);

  useEffect(() => {
    if (highSchoolBranches.length === 0) return;
    fetch(`/api/students?branchIds=${highSchoolBranches.map((b) => b.id).join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        const students: XrayRosterStudent[] = (data.students ?? []).map(
          (s: { id: string; firstName: string; lastName: string; branchName: string }) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            branchName: s.branchName,
          })
        );
        setRoster(students);
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches]);

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <XrayTopBar roleLabel="Öğretmen" />
      <XrayResultsPanel roster={roster} defaultSubject={subject} />
    </div>
  );
}
