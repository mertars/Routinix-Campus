"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  DoorOpen,
  IdCard,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { KrokiEditorModal } from "@/components/principal/exam/kroki-editor";
import { fetchAndDownloadPdf } from "@/lib/client/download-pdf";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

export type PrintSeat = { seatNumber: number; studentName: string; branchName: string };

const BRANCH_COLORS = [
  "bg-brand-100 text-brand-800 dark:bg-brand-600/20 dark:text-brand-300",
  "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300",
  "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300",
  "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300",
];

const inputClass =
  "rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";

type ClassroomSummary = { id: string; name: string; deskCount: number; seatCount: number };
type Branch = { id: string; name: string; studentCount: number };
type ExamOption = { id: string; name: string; examDate: string };
type ServerSeat = PrintSeat & { branchId: string };

export function ExamSeatingTab() {
  const [view, setView] = useState<"classrooms" | "new-plan">("classrooms");

  return (
    <div className="space-y-4">
      <div className="flex w-fit gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
        <button
          onClick={() => setView("classrooms")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition",
            view === "classrooms" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40"
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Sınıflar
        </button>
        <button
          onClick={() => setView("new-plan")}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition",
            view === "new-plan" ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40"
          )}
        >
          <Shuffle className="h-3.5 w-3.5" /> Yeni Oturma Planı
        </button>
      </div>

      {view === "classrooms" ? <ClassroomsView /> : <NewPlanView />}
    </div>
  );
}

// "Sınıflar": fiziksel sınıf (kroki) listesi — oluştur, sürükle-bırak
// editörüyle düzenle, sil. Şube kavramından BAĞIMSIZ (bkz. lib/seating/types.ts).
function ClassroomsView() {
  const { showError, showSuccess } = useToast();
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  function loadClassrooms() {
    setLoading(true);
    fetch("/api/admin/classrooms")
      .then((res) => res.json())
      .then((data: { classrooms?: ClassroomSummary[] }) => setClassrooms(data.classrooms ?? []))
      .catch(() => showError("Sınıflar yüklenemedi."))
      .finally(() => setLoading(false));
  }

  useEffect(loadClassrooms, [showError]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sınıf oluşturulamadı.");
      setNewModalOpen(false);
      setNewName("");
      loadClassrooms();
      setEditingClassroom({ id: data.classroom.id, name: data.classroom.name });
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sınıf oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/classrooms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinemedi.");
      showSuccess("Sınıf silindi.");
      setConfirmDeleteId(null);
      loadClassrooms();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <motion.div
        whileHover={{ scale: 1.002 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-espresso dark:text-cream">Fiziksel Sınıflar (Kroki)</h2>
          <button
            onClick={() => setNewModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <Plus className="h-3.5 w-3.5" /> Yeni Sınıf
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-espresso-muted dark:text-cream/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : classrooms.length === 0 ? (
          <p className="py-8 text-center text-sm text-espresso-muted dark:text-cream/40">
            Henüz bir sınıf (kroki) yok. Sınav oturma planı oluşturabilmek için önce bir sınıf ekle.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((c) => (
              <div
                key={c.id}
                className="rounded-2xl border border-hairline p-4 transition hover:border-brand-500/40 dark:border-white/10"
              >
                {confirmDeleteId === c.id ? (
                  <div className="space-y-2">
                    <p className="flex items-start gap-1.5 text-xs text-espresso-muted dark:text-cream/50">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                      &quot;{c.name}&quot; silinsin mi? Geçmiş bir sınav oturma kaydı varsa silinemez.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="flex-1 rounded-lg border border-hairline py-1.5 text-xs font-medium text-espresso-muted hover:bg-cream-card dark:border-white/10 dark:text-cream/40 dark:hover:bg-white/5"
                      >
                        Vazgeç
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Evet, Sil"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-espresso dark:text-cream">{c.name}</p>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => setEditingClassroom({ id: c.id, name: c.name })}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card dark:text-cream/40 dark:hover:bg-white/10"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(c.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-espresso-muted transition hover:bg-red-100 hover:text-red-600 dark:text-cream/40 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-espresso-muted dark:text-cream/40">
                      {c.deskCount} masa · {c.seatCount} koltuk
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <Modal isOpen={newModalOpen} onClose={() => setNewModalOpen(false)} title="Yeni Sınıf Ekle">
        <div className="space-y-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder='Sınıf Adı (örn. "A-101", "Konferans Salonu")'
            className={cn(inputClass, "w-full")}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {creating ? "Oluşturuluyor..." : "Sınıfı Oluştur ve Krokiyi Düzenle"}
        </button>
      </Modal>

      <KrokiEditorModal
        classroomId={editingClassroom?.id ?? null}
        classroomName={editingClassroom?.name ?? ""}
        onClose={() => setEditingClassroom(null)}
        onSaved={() => {
          setEditingClassroom(null);
          loadClassrooms();
        }}
      />
    </>
  );
}

// "Yeni Oturma Planı": gerçek sınav + gerçek sınıf (kroki) + şube seçimi →
// kelebek algoritmasını çalıştır → sonucu incele/yazdır.
function NewPlanView() {
  const { showError } = useToast();
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [selectedExamId, setSelectedExamId] = useState("");
  const [creatingNewExam, setCreatingNewExam] = useState(false);
  const [newExamName, setNewExamName] = useState("");
  const [savingExam, setSavingExam] = useState(false);

  const [selectedClassroomId, setSelectedClassroomId] = useState("");
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);

  const [isRunning, setIsRunning] = useState(false);
  const [seats, setSeats] = useState<ServerSeat[] | null>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [unseated, setUnseated] = useState<{ id: string; name: string; branchName: string }[]>([]);
  const [alreadySeatedElsewhereCount, setAlreadySeatedElsewhereCount] = useState(0);

  const [downloadingEntrySeat, setDownloadingEntrySeat] = useState<number | null>(null);
  const [downloadingDoorList, setDownloadingDoorList] = useState(false);

  useEffect(() => {
    setLoadingOptions(true);
    Promise.all([
      fetch("/api/exams").then((r) => r.json()),
      fetch("/api/admin/classrooms").then((r) => r.json()),
      fetch("/api/admin/branches").then((r) => r.json()),
    ])
      .then(([examsData, classroomsData, branchesData]) => {
        const examList: ExamOption[] = examsData.exams ?? [];
        setExams(examList);
        setClassrooms(classroomsData.classrooms ?? []);
        setBranches(branchesData.branches ?? []);
        if (examList.length > 0) setSelectedExamId(examList[0].id);
      })
      .catch(() => showError("Seçenekler yüklenemedi."))
      .finally(() => setLoadingOptions(false));
  }, [showError]);

  function toggleBranch(id: string) {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function handleCreateExam() {
    if (!newExamName.trim()) return;
    setSavingExam(true);
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newExamName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Sınav oluşturulamadı.");
      setExams((prev) => [data.exam, ...prev]);
      setSelectedExamId(data.exam.id);
      setNewExamName("");
      setCreatingNewExam(false);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Sınav oluşturulamadı.");
    } finally {
      setSavingExam(false);
    }
  }

  async function runAlgorithm() {
    if (!selectedExamId || !selectedClassroomId || selectedBranchIds.length < 2) return;
    setIsRunning(true);
    setSeats(null);
    try {
      const res = await fetch("/api/admin/exam-seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: selectedExamId, classroomId: selectedClassroomId, branchIds: selectedBranchIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Oturma planı oluşturulamadı.");
      setSeats(
        data.seats.map((s: { seatNumber: number; studentName: string; branchName: string; branchId: string }) => ({
          seatNumber: s.seatNumber,
          studentName: s.studentName,
          branchName: s.branchName,
          branchId: s.branchId,
        }))
      );
      setViolationCount(data.violationCount ?? 0);
      setUnseated(data.unseated ?? []);
      setAlreadySeatedElsewhereCount(data.alreadySeatedElsewhereCount ?? 0);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Oturma planı oluşturulamadı.");
    } finally {
      setIsRunning(false);
    }
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);
  const examDateLabel = selectedExam ? new Date(selectedExam.examDate).toLocaleDateString("tr-TR") : "";
  const hallLabel = selectedClassroom?.name ?? "";

  async function downloadEntryPdf(seat: PrintSeat) {
    setDownloadingEntrySeat(seat.seatNumber);
    try {
      await fetchAndDownloadPdf(
        "/api/exam-seating/pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "entry", hall: hallLabel, examName: selectedExam?.name ?? "", examDate: examDateLabel, seat }),
        },
        `${seat.studentName}-sinav-giris-belgesi.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setDownloadingEntrySeat(null);
    }
  }

  async function downloadDoorListPdf() {
    if (!seats || seats.length === 0) return;
    setDownloadingDoorList(true);
    try {
      await fetchAndDownloadPdf(
        "/api/exam-seating/pdf",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "doorList", hall: hallLabel, examName: selectedExam?.name ?? "", examDate: examDateLabel, seats }),
        },
        `${hallLabel}-salon-kapi-listesi.pdf`.replace(/\s+/g, "-")
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    } finally {
      setDownloadingDoorList(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.002 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
      >
        <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Kelebek Sınav Oturum Planı</h2>

        {loadingOptions ? (
          <div className="flex items-center justify-center py-10 text-espresso-muted dark:text-cream/40">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Sınav</label>
                {creatingNewExam ? (
                  <div className="flex gap-2">
                    <input
                      value={newExamName}
                      onChange={(e) => setNewExamName(e.target.value)}
                      placeholder="Sınav adı (örn. YKS Genel Deneme-5)"
                      className={cn(inputClass, "flex-1")}
                    />
                    <button
                      onClick={handleCreateExam}
                      disabled={!newExamName.trim() || savingExam}
                      className="rounded-lg bg-espresso px-3 py-2 text-xs font-medium text-cream disabled:opacity-50 dark:bg-brand-600"
                    >
                      {savingExam ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ekle"}
                    </button>
                    <button
                      onClick={() => setCreatingNewExam(false)}
                      className="rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-espresso-muted dark:border-white/10 dark:text-cream/40"
                    >
                      Vazgeç
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)} className={cn(inputClass, "flex-1")}>
                      {exams.length === 0 && <option value="">Sınav yok</option>}
                      {exams.map((exam) => (
                        <option key={exam.id} value={exam.id}>
                          {exam.name} · {new Date(exam.examDate).toLocaleDateString("tr-TR")}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setCreatingNewExam(true)}
                      className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Yeni
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Sınıf</label>
                <select
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  disabled={classrooms.length === 0}
                  className={cn(inputClass, "w-full")}
                >
                  <option value="">{classrooms.length === 0 ? "Önce 'Sınıflar' sekmesinden bir sınıf oluştur" : "Sınıf seç"}</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.seatCount} koltuk
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mb-2 text-xs font-medium text-espresso-muted dark:text-cream/40">
              Karıştırılacak şubeleri seçin (yan yana gelmemesi için en az 2 şube gerekir)
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {branches.map((branch) => (
                <button
                  key={branch.id}
                  onClick={() => toggleBranch(branch.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    selectedBranchIds.includes(branch.id)
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-hairline text-espresso-muted hover:border-brand-600/50 dark:border-white/10 dark:text-cream/40"
                  )}
                >
                  {branch.name} · {branch.studentCount} öğrenci
                </button>
              ))}
            </div>

            <button
              onClick={runAlgorithm}
              disabled={!selectedExamId || !selectedClassroomId || selectedBranchIds.length < 2 || isRunning}
              className="flex items-center gap-2 rounded-lg bg-espresso px-4 py-2 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {isRunning ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                  <Loader2 className="h-3.5 w-3.5" />
                </motion.span>
              ) : (
                <Shuffle className="h-3.5 w-3.5" />
              )}
              {isRunning ? "Kelebek Algoritması Çalışıyor..." : "Kelebek Algoritmasını Çalıştır ve Kaydet"}
            </button>
          </>
        )}
      </motion.div>

      <AnimatePresence>
        {seats && seats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-espresso dark:text-cream">
                Oturma Planı — {hallLabel} ({seats.length} koltuk)
              </h2>
              <button
                onClick={downloadDoorListPdf}
                disabled={downloadingDoorList}
                className="flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-cream-card disabled:opacity-50 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                {downloadingDoorList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DoorOpen className="h-3.5 w-3.5" />} Salon Kapı Listesi İndir
              </button>
            </div>

            {(violationCount > 0 || unseated.length > 0 || alreadySeatedElsewhereCount > 0) && (
              <div className="mb-4 space-y-1.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
                {violationCount > 0 && (
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {violationCount} koltukta aynı şubeden öğrenciler yan yana/aynı masada
                    kalmak zorunda kaldı (yetersiz masa/komşuluk seçeneği) — elle düzeltmek isteyebilirsin.
                  </p>
                )}
                {unseated.length > 0 && (
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {unseated.length} öğrenci koltuk yetersizliğinden oturtulamadı:{" "}
                    {unseated.map((u) => u.name).join(", ")}.
                  </p>
                )}
                {alreadySeatedElsewhereCount > 0 && (
                  <p className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {alreadySeatedElsewhereCount} öğrenci bu sınavda zaten başka bir sınıfa
                    atanmış olduğu için bu çalıştırmaya dahil edilmedi.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {seats.map((seat, index) => {
                const colorIndex = selectedBranchIds.indexOf(seat.branchId);
                return (
                  <motion.button
                    key={seat.seatNumber}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.02 }}
                    whileHover={{ scale: 1.05, y: -2 }}
                    onClick={() => downloadEntryPdf(seat)}
                    disabled={downloadingEntrySeat === seat.seatNumber}
                    className={cn("rounded-xl p-2.5 text-left transition disabled:opacity-60", BRANCH_COLORS[(colorIndex < 0 ? 0 : colorIndex) % BRANCH_COLORS.length])}
                  >
                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      <span>Koltuk {seat.seatNumber}</span>
                      {downloadingEntrySeat === seat.seatNumber ? <Loader2 className="h-3 w-3 animate-spin" /> : <IdCard className="h-3 w-3" />}
                    </div>
                    <p className="mt-1 truncate text-xs font-semibold">{seat.studentName}</p>
                    <p className="truncate text-[10px] opacity-70">{seat.branchName}</p>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
