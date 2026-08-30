"use client";

import { useEffect, useState } from "react";
import { XrayTopBar } from "@/components/xray/xray-top-bar";
import { XrayResultsPanel, type XrayRosterStudent } from "@/components/xray/xray-results-panel";
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
      <XrayResultsPanel roster={roster} canAssign />
    </div>
  );
}
