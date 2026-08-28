"use client";

import { useCallback, useEffect, useState, memo } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, GraduationCap, UserCog2, Users, FileUp, Layers, Pencil, UserX, UserCheck } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { AddUserModal } from "@/components/principal/user-management/add-user-modal";
import { AddBranchModal } from "@/components/principal/user-management/add-branch-modal";
import { EditUserModal, type EditTarget } from "@/components/principal/user-management/edit-user-modal";
import { CredentialsCardModal, type NewUserCredentials } from "@/components/principal/user-management/credentials-card-modal";
import { PerformanceInspectorModal } from "@/components/principal/user-management/performance-inspector-modal";
import { DeactivateConfirmModal, type DeactivateTarget } from "@/components/principal/user-management/deactivate-confirm-modal";
import { cn } from "@/lib/utils";

type BranchOption = { id: string; name: string };

// xlsx + pdfjs-dist büyük kütüphaneler — sadece sihirbaz gerçekten açıldığında
// (nadir bir işlem) ayrı bir chunk olarak yüklensin diye dinamik import
// ediliyor; aksi halde Kadro Dizini'ne her girişte ~150KB fazladan JS iner.
const BulkImportWizard = dynamic(
  () => import("@/components/principal/user-management/bulk-import-wizard").then((mod) => mod.BulkImportWizard),
  { ssr: false }
);

type DirectoryRole = "STUDENT" | "TEACHER";
type StudentRow = { id: string; firstName: string; lastName: string; studentNumber: string; isActive: boolean; branchId: string; branchName: string };
type TeacherRow = { id: string; firstName: string; lastName: string; subject: string; mobilePhone: string; institutionalCode: string | null; isActive: boolean; branchNames: string[] };

// PERFORMANS: kadro büyüdükçe (100+ öğrenci) her arama tuşuna basışta TÜM
// satırların yeniden render edilmesi hissedilir bir gecikmeye yol açıyordu.
// React.memo, sadece KENDİ verisi değişen satırın yeniden çizilmesini
// sağlar — bunun işe yaraması için onClick callback'lerinin PARENT'ta
// useCallback ile SABİT referanslı olması şart (aksi halde memo etkisiz
// kalır, her render'da "yeni" prop görür); bkz. handleInspect/handleEdit.
const StudentRowCard = memo(function StudentRowCard({
  student,
  onInspect,
  onEdit,
  onDeactivate,
}: {
  student: StudentRow;
  onInspect: (id: string, role: DirectoryRole, name: string) => void;
  onEdit: (id: string, role: DirectoryRole, name: string) => void;
  onDeactivate: (id: string, role: DirectoryRole, name: string, isActive: boolean) => void;
}) {
  const fullName = `${student.firstName} ${student.lastName}`;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex items-center gap-1.5 rounded-xl bg-cream-card pr-2 transition hover:bg-brand-50 dark:bg-white/5 dark:hover:bg-brand-600/10",
        !student.isActive && "opacity-50"
      )}
    >
      <button onClick={() => onInspect(student.id, "STUDENT", fullName)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
        <AvatarInitials name={fullName} className="h-9 w-9 text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-espresso dark:text-cream">
            {fullName} {!student.isActive && <span className="font-normal text-espresso-muted dark:text-cream/40">(Pasif)</span>}
          </p>
          <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">{student.branchName} · No: {student.studentNumber}</p>
        </div>
      </button>
      {student.isActive && (
        <button
          onClick={() => onEdit(student.id, "STUDENT", fullName)}
          aria-label="Öğrenciyi düzenle"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-white hover:text-brand-600 dark:text-cream/40 dark:hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={() => onDeactivate(student.id, "STUDENT", fullName, student.isActive)}
        aria-label={student.isActive ? "Öğrenciyi pasifleştir" : "Öğrenciyi aktifleştir"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-white dark:text-cream/40 dark:hover:bg-white/10",
          student.isActive ? "hover:text-red-600" : "hover:text-green-600"
        )}
      >
        {student.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
      </button>
    </motion.div>
  );
});

const TeacherRowCard = memo(function TeacherRowCard({
  teacher,
  onInspect,
  onEdit,
  onDeactivate,
}: {
  teacher: TeacherRow;
  onInspect: (id: string, role: DirectoryRole, name: string) => void;
  onEdit: (id: string, role: DirectoryRole, name: string) => void;
  onDeactivate: (id: string, role: DirectoryRole, name: string, isActive: boolean) => void;
}) {
  const fullName = `${teacher.firstName} ${teacher.lastName}`;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={cn(
        "flex items-center gap-1.5 rounded-xl bg-cream-card pr-2 transition hover:bg-brand-50 dark:bg-white/5 dark:hover:bg-brand-600/10",
        !teacher.isActive && "opacity-50"
      )}
    >
      <button onClick={() => onInspect(teacher.id, "TEACHER", fullName)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left">
        <AvatarInitials name={fullName} className="h-9 w-9 text-xs" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-espresso dark:text-cream">
            {fullName} {!teacher.isActive && <span className="font-normal text-espresso-muted dark:text-cream/40">(Pasif)</span>}
          </p>
          <p className="truncate text-[11px] text-espresso-muted dark:text-cream/40">
            {teacher.subject} · {teacher.branchNames.join(", ") || "Danışman şube yok"}
            {teacher.institutionalCode && <span className="font-mono"> · {teacher.institutionalCode}</span>}
          </p>
        </div>
      </button>
      {teacher.isActive && (
        <button
          onClick={() => onEdit(teacher.id, "TEACHER", fullName)}
          aria-label="Öğretmeni düzenle"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-white hover:text-brand-600 dark:text-cream/40 dark:hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={() => onDeactivate(teacher.id, "TEACHER", fullName, teacher.isActive)}
        aria-label={teacher.isActive ? "Öğretmeni pasifleştir" : "Öğretmeni aktifleştir"}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-espresso-muted transition hover:bg-white dark:text-cream/40 dark:hover:bg-white/10",
          teacher.isActive ? "hover:text-red-600" : "hover:text-green-600"
        )}
      >
        {teacher.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
      </button>
    </motion.div>
  );
});

export function BranchStaffTab() {
  const { showError } = useToast();
  const [role, setRole] = useState<DirectoryRole>("STUDENT");
  const [query, setQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<BranchOption[]>([]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [credentials, setCredentials] = useState<NewUserCredentials | null>(null);
  const [inspectorTarget, setInspectorTarget] = useState<{ id: string; role: DirectoryRole; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget>(null);

  // Sabit referanslar — StudentRowCard/TeacherRowCard'ın React.memo'su
  // ancak bu callback'ler HER render'da "yeni" fonksiyon olmazsa işe yarar.
  const handleInspect = useCallback((id: string, role: DirectoryRole, name: string) => setInspectorTarget({ id, role, name }), []);
  const handleEdit = useCallback((id: string, role: DirectoryRole, name: string) => setEditTarget({ id, role, name }), []);
  const handleDeactivate = useCallback(
    (id: string, role: DirectoryRole, name: string, isActive: boolean) => setDeactivateTarget({ id, role, name, isActive }),
    []
  );

  async function loadDirectory() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role });
      if (query.trim()) params.set("query", query.trim());
      if (role === "STUDENT" && branchFilter) params.set("branchId", branchFilter);
      if (includeInactive) params.set("includeInactive", "1");
      const res = await fetch(`/api/admin/users/directory?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      if (role === "STUDENT") setStudents(data.students ?? []);
      else setTeachers(data.teachers ?? []);
    } catch {
      showError("Kadro dizini yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadDirectory, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, query, branchFilter, includeInactive]);

  async function loadBranches() {
    try {
      const res = await fetch("/api/admin/branches");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setBranches(data.branches ?? []);
    } catch {
      showError("Şube listesi yüklenemedi.");
    }
  }

  useEffect(() => {
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCount = role === "STUDENT" ? students.length : teachers.length;

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-espresso dark:text-cream">Kadro & Kullanıcı Yönetimi</h2>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              {loading ? "Yükleniyor..." : `${totalCount} ${role === "STUDENT" ? "öğrenci" : "öğretmen"} listeleniyor`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Plus className="h-3.5 w-3.5" /> Yeni Kullanıcı Ekle
            </button>
          </div>
        </div>

        <div className="mb-3 flex gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
          <button
            onClick={() => setRole("STUDENT")}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition", role === "STUDENT" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
          >
            <GraduationCap className="h-3.5 w-3.5" /> Öğrenciler
          </button>
          <button
            onClick={() => setRole("TEACHER")}
            className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition", role === "TEACHER" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40")}
          >
            <UserCog2 className="h-3.5 w-3.5" /> Öğretmenler
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2 dark:border-white/10 dark:bg-midnight">
            <Search className="h-4 w-4 shrink-0 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={role === "STUDENT" ? "İsim veya öğrenci no ile ara..." : "İsim veya kurumsal kod ile ara..."}
              className="w-full bg-transparent text-sm text-espresso outline-none dark:text-cream"
            />
          </div>
          {role === "STUDENT" && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              <option value="">Tüm Şubeler</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <label className="flex shrink-0 items-center gap-1.5 rounded-xl border border-hairline px-3 py-2 text-xs font-medium text-espresso-muted dark:border-white/10 dark:text-cream/40">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="accent-brand-600" />
            Pasifleri de göster
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {role === "STUDENT"
              ? students.map((s) => <StudentRowCard key={s.id} student={s} onInspect={handleInspect} onEdit={handleEdit} onDeactivate={handleDeactivate} />)
              : teachers.map((t) => <TeacherRowCard key={t.id} teacher={t} onInspect={handleInspect} onEdit={handleEdit} onDeactivate={handleDeactivate} />)}
          </AnimatePresence>
          {!loading && totalCount === 0 && (
            <p className="col-span-full flex items-center gap-1.5 py-6 text-center text-xs text-espresso-muted dark:text-cream/40">
              <Users className="h-3.5 w-3.5" /> Sonuç bulunamadı.
            </p>
          )}
        </div>
      </motion.div>

      <AddUserModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        branches={branches}
        onCreated={(newCredentials) => {
          setCredentials(newCredentials);
          loadDirectory();
        }}
      />
      <AddBranchModal
        isOpen={isAddBranchOpen}
        onClose={() => setIsAddBranchOpen(false)}
        onCreated={() => loadBranches()}
      />
      <CredentialsCardModal credentials={credentials} onClose={() => setCredentials(null)} />
      <PerformanceInspectorModal target={inspectorTarget} onClose={() => setInspectorTarget(null)} />
      <EditUserModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        branches={branches}
        onUpdated={loadDirectory}
        onPasswordReset={setCredentials}
      />
      <DeactivateConfirmModal target={deactivateTarget} onClose={() => setDeactivateTarget(null)} onChanged={loadDirectory} />
      <BulkImportWizard
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onImported={() => {
          loadDirectory();
          loadBranches();
        }}
        branchNames={branches.map((b) => b.name)}
      />
    </div>
  );
}
