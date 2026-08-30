"use client";

import { useEffect, useState } from "react";
import { XrayTopBar } from "@/components/xray/xray-top-bar";
import { XrayResultsPanel, type XrayRosterStudent } from "@/components/xray/xray-results-panel";
import { useToast } from "@/lib/toast-context";

// Kurum geneli röntgen merkezi — roster TÜM kurumdan gelir (bkz.
// /api/admin/users/directory, academic-xray.tsx'teki AYNI desen).
export default function XrayPrincipalPage() {
  const { showError } = useToast();
  const [roster, setRoster] = useState<XrayRosterStudent[]>([]);

  useEffect(() => {
    fetch("/api/admin/users/directory?role=STUDENT")
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
  }, []);

  return (
    <div className="min-h-screen bg-cream dark:bg-midnight">
      <XrayTopBar roleLabel="Yönetici" />
      <XrayResultsPanel roster={roster} canAssign />
    </div>
  );
}
