"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { GraduationCap, UserCog2, FileSpreadsheet, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AccountRow = { id: string; name: string; phone: string; createdAt: string; branchName?: string; subject?: string };
type DetailData = { institution: { id: string; name: string }; students: AccountRow[]; teachers: AccountRow[] };

// Platform sahibinin hesap-başına faturalama için baktığı TEK ekran —
// bkz. app/api/platform/institutions/[id]/route.ts. Sadece faturalama için
// gereken minimum alanları (isim, telefon, şube/branş, açılış tarihi)
// gösterir; öğrenci/öğretmenin ders/not/veli bilgisi gibi başka hiçbir
// verisine platform oturumundan erişilmez (bkz. session-guard'daki bilinçli
// izolasyon — o veriler sadece kurumun kendi oturumundan görülebilir).
export function InstitutionDetailModal({ institutionId, onClose }: { institutionId: string | null; onClose: () => void }) {
  const { showError } = useToast();
  const [data, setData] = useState<DetailData | null>(null);
  const [tab, setTab] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!institutionId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/platform/institutions/${institutionId}`)
      .then((res) => res.json())
      .then((result) => {
        if (result.error) throw new Error(result.error);
        setData(result);
      })
      .catch(() => showError("Kurum detayı yüklenemedi."))
      .finally(() => setLoading(false));
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
    <Modal isOpen={!!institutionId} onClose={onClose} title={data ? `${data.institution.name} — Hesap Listesi` : "Hesap Listesi"} widthClassName="max-w-2xl">
      {loading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
              <button
                onClick={() => setTab("STUDENT")}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition", tab === "STUDENT" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
              >
                <GraduationCap className="h-3.5 w-3.5" /> Öğrenciler ({data.students.length})
              </button>
              <button
                onClick={() => setTab("TEACHER")}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition", tab === "TEACHER" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
              >
                <UserCog2 className="h-3.5 w-3.5" /> Öğretmenler ({data.teachers.length})
              </button>
            </div>
            <button
              onClick={exportToExcel}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel&apos;e Aktar
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto rounded-xl border border-hairline dark:border-white/10">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-cream-card dark:bg-midnight-card">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium text-espresso-muted dark:text-cream/40">Ad Soyad</th>
                  <th className="px-3 py-2 font-medium text-espresso-muted dark:text-cream/40">Telefon</th>
                  <th className="px-3 py-2 font-medium text-espresso-muted dark:text-cream/40">{tab === "STUDENT" ? "Şube" : "Branş"}</th>
                  <th className="px-3 py-2 font-medium text-espresso-muted dark:text-cream/40">Kayıt Tarihi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-hairline dark:border-white/10">
                    <td className="px-3 py-2 text-espresso dark:text-cream">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-espresso-muted dark:text-cream/40">{row.phone}</td>
                    <td className="px-3 py-2 text-espresso-muted dark:text-cream/40">{row.branchName ?? row.subject}</td>
                    <td className="px-3 py-2 text-espresso-muted dark:text-cream/40">{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-espresso-muted dark:text-cream/40">
                      Henüz kayıt yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}
