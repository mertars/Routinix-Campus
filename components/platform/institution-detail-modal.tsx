"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import * as XLSX from "xlsx";
import { GraduationCap, UserCog2, FileSpreadsheet, Loader2, Plus, FileUp, Layers, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { AddBranchModal } from "@/components/principal/user-management/add-branch-modal";
import { AddUserModal } from "@/components/principal/user-management/add-user-modal";
import { EditUserModal, type EditTarget } from "@/components/principal/user-management/edit-user-modal";
import { CredentialsCardModal, type NewUserCredentials } from "@/components/principal/user-management/credentials-card-modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// xlsx + pdfjs-dist büyük kütüphaneler — bkz. branch-staff.tsx'teki AYNI
// dinamik import deseni.
const BulkImportWizard = dynamic(
  () => import("@/components/principal/user-management/bulk-import-wizard").then((mod) => mod.BulkImportWizard),
  { ssr: false }
);

type AccountRow = { id: string; name: string; phone: string; createdAt: string; branchName?: string; subject?: string };
type BranchOption = { id: string; name: string };
type DetailData = { institution: { id: string; name: string }; students: AccountRow[]; teachers: AccountRow[] };

// Platform sahibinin, bir dershaneye HİÇ giriş yapmadan onun İLK
// KURULUMUNU (şubeler + tüm öğrenci/öğretmen listesi, tekli veya Excel
// toplu) yapabildiği tek ekran — bkz. app/platform/page.tsx. Kurum
// yöneticisinin components/principal/tabs/branch-staff.tsx'te kullandığı
// AYNI modalları (AddBranchModal/AddUserModal/EditUserModal/
// BulkImportWizard/CredentialsCardModal) apiBase="/api/platform/institutions/{id}"
// ile burada da kullanır — iki panelin arayışı/davranışı asla birbirinden
// SAPMAZ, tek bir yerde bakım yapılır.
export function InstitutionDetailModal({ institutionId, onClose }: { institutionId: string | null; onClose: () => void }) {
  const { showError } = useToast();
  const apiBase = institutionId ? `/api/platform/institutions/${institutionId}` : "";

  const [data, setData] = useState<DetailData | null>(null);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [tab, setTab] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [loading, setLoading] = useState(false);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [newCredentials, setNewCredentials] = useState<NewUserCredentials | null>(null);

  async function loadAll() {
    if (!institutionId) return;
    setLoading(true);
    try {
      const [detailRes, branchesRes] = await Promise.all([
        fetch(`/api/platform/institutions/${institutionId}`).then((r) => r.json()),
        fetch(`${apiBase}/branches`).then((r) => r.json()),
      ]);
      if (detailRes.error) throw new Error(detailRes.error);
      setData(detailRes);
      setBranches(branchesRes.branches ?? []);
    } catch {
      showError("Kurum detayı yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!institutionId) {
      setData(null);
      setBranches([]);
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function exportToExcel() {
    if (!data) return;
    const workbook = XLSX.utils.book_new();
    const studentSheet = XLSX.utils.json_to_sheet(
      data.students.map((s) => ({ "Ad Soyad": s.name, Telefon: s.phone, Şube: s.branchName, "Kayıt Tarihi": formatDate(s.createdAt) }))
    );
    const teacherSheet = XLSX.utils.json_to_sheet(
      data.teachers.map((t) => ({ "Ad Soyad": t.name, Telefon: t.phone, Branş: t.subject, "Kayıt Tarihi": formatDate(t.createdAt) }))
    );
    XLSX.utils.book_append_sheet(workbook, studentSheet, "Öğrenciler");
    XLSX.utils.book_append_sheet(workbook, teacherSheet, "Öğretmenler");
    XLSX.writeFile(workbook, `${data.institution.name}-hesap-listesi.xlsx`);
  }

  const rows = data ? (tab === "STUDENT" ? data.students : data.teachers) : [];

  return (
    <>
      <Modal isOpen={!!institutionId} onClose={onClose} title={data ? `${data.institution.name} — Kurulum & Hesaplar` : "Kurulum & Hesaplar"} widthClassName="max-w-3xl">
        {loading || !data ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setIsAddBranchOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <Layers className="h-3.5 w-3.5" /> Yeni Şube Ekle
              </button>
              <button
                onClick={() => setIsBulkImportOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <FileUp className="h-3.5 w-3.5" /> Excel/Dosya İçe Aktar
              </button>
              <button
                onClick={() => setIsAddUserOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                <Plus className="h-3.5 w-3.5" /> Yeni Kullanıcı Ekle
              </button>
              <button
                onClick={exportToExcel}
                className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel&apos;e Aktar
              </button>
            </div>

            <div className="mb-3 flex gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
              <button
                onClick={() => setTab("STUDENT")}
                className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition", tab === "STUDENT" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Öğrenciler ({data.students.length})
              </button>
              <button
                onClick={() => setTab("TEACHER")}
                className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition", tab === "TEACHER" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
              >
                <UserCog2 className="h-3.5 w-3.5" /> Öğretmenler ({data.teachers.length})
              </button>
            </div>

            <div className="max-h-96 space-y-1.5 overflow-y-auto">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="long-list-compact flex items-center gap-1.5 rounded-xl bg-cream-card px-3 py-2.5 pr-2 dark:bg-white/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-espresso dark:text-cream">{row.name}</p>
                    <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
                      {row.phone} · {row.branchName ?? row.subject} · {formatDate(row.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setEditTarget({ id: row.id, role: tab, name: row.name })}
                    aria-label={tab === "STUDENT" ? "Öğrenciyi düzenle" : "Öğretmeni düzenle"}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-white hover:text-brand-600 dark:text-cream/40 dark:hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {rows.length === 0 && (
                <p className="py-8 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz kayıt yok.</p>
              )}
            </div>
          </>
        )}
      </Modal>

      <AddBranchModal isOpen={isAddBranchOpen} onClose={() => setIsAddBranchOpen(false)} apiBase={apiBase} onCreated={() => loadAll()} />
      <AddUserModal
        isOpen={isAddUserOpen}
        onClose={() => setIsAddUserOpen(false)}
        apiBase={apiBase}
        branches={branches}
        onCreated={(credentials) => {
          setNewCredentials(credentials);
          loadAll();
        }}
      />
      <EditUserModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        apiBase={apiBase}
        branches={branches}
        onUpdated={loadAll}
        onPasswordReset={setNewCredentials}
      />
      <BulkImportWizard
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        apiBase={apiBase}
        branchNames={branches.map((b) => b.name)}
        onImported={loadAll}
      />
      <CredentialsCardModal credentials={newCredentials} onClose={() => setNewCredentials(null)} sendCredentialsEndpoint="/api/platform/send-credentials" />
    </>
  );
}
