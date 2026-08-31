"use client";

import { useEffect, useState } from "react";
import { ListTodo } from "lucide-react";
import { XrayTopBar } from "@/components/xray/xray-top-bar";
import { XrayResultsPanel, type XrayRosterStudent } from "@/components/xray/xray-results-panel";
import { XrayMonthlyScreeningPanel } from "@/components/xray/xray-monthly-screening-panel";
import { XrayInstitutionInsights } from "@/components/xray/xray-institution-insights";
import { XrayAssignmentTrackingDashboard } from "@/components/xray/xray-assignment-tracking-dashboard";
import { useToast } from "@/lib/toast-context";

// Kurum geneli röntgen merkezi — roster TÜM kurumdan gelir (bkz.
// /api/admin/users/directory, academic-xray.tsx'teki AYNI desen).
//
// Faz K — Akademik Röntgen ŞUANLIK SADECE lise (9-12. sınıf) için: roster
// grade < 9 olan (ortaokul/LGS) öğrencileri BİLEREK dışarıda bırakıyor.
// Ortaokul desteği ileride eklenecek — bu filtre o zaman kaldırılacak/
// genişletilecek, panelin geri kalanı (3 sütunlu düzen, atama, trend
// grafikleri) zaten sınıf seviyesinden bağımsız, değişiklik gerekmeyecek.
export default function XrayPrincipalPage() {
  const { showError } = useToast();
  const [roster, setRoster] = useState<XrayRosterStudent[]>([]);
  const [trackingOpen, setTrackingOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => res.json())
      .then((data) => {
        const students: XrayRosterStudent[] = (data.students ?? [])
          .filter((s: { grade: number | null }) => (s.grade ?? 0) >= 9)
          .map((s: { id: string; firstName: string; lastName: string; branchName: string; branchId: string; grade: number }) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            branchName: s.branchName,
            branchId: s.branchId,
            grade: s.grade,
          }));
        setRoster(students);
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <XrayTopBar roleLabel="Yönetici" />
      <div className="space-y-3 px-4 pt-4 lg:px-6">
        <div className="mx-auto flex max-w-[1600px] justify-end">
          <button
            onClick={() => setTrackingOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3.5 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
          >
            <ListTodo className="h-3.5 w-3.5" /> Ödev Takip
          </button>
        </div>
        <XrayMonthlyScreeningPanel />
        <XrayInstitutionInsights />
      </div>
      <XrayResultsPanel roster={roster} canAssign />
      <XrayAssignmentTrackingDashboard isOpen={trackingOpen} onClose={() => setTrackingOpen(false)} />
    </div>
  );
}
