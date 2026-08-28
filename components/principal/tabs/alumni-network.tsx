"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Trophy, Handshake, Plus, Trash2, Check, X, Inbox, Loader2 } from "lucide-react";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { StudentSearchSelect, type StudentOption } from "@/components/principal/student-search-select";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AlumniProfile = {
  id: string;
  studentId: string;
  name: string;
  graduationYear: number;
  highSchoolRank: string | null;
  admittedTo: string;
  examScope: string;
  isMentor: boolean;
  mentorNote: string | null;
  contactPhone: string | null;
};

type MentorRequestRow = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  message: string | null;
  createdAt: string;
  mentorName: string;
  requesterName: string;
  requesterBranchName: string;
};

const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

function AddAlumniModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const { showError, showSuccess } = useToast();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [graduationYear, setGraduationYear] = useState(String(new Date().getFullYear()));
  const [highSchoolRank, setHighSchoolRank] = useState("");
  const [admittedTo, setAdmittedTo] = useState("");
  const [examScope, setExamScope] = useState<"YKS" | "LGS">("YKS");
  const [isMentor, setIsMentor] = useState(false);
  const [mentorNote, setMentorNote] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => res.json())
      .then((data) => setStudents(data.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function reset() {
    setStudentId("");
    setGraduationYear(String(new Date().getFullYear()));
    setHighSchoolRank("");
    setAdmittedTo("");
    setExamScope("YKS");
    setIsMentor(false);
    setMentorNote("");
    setContactPhone("");
  }

  const isValid = !!studentId && admittedTo.trim().length > 0;

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          graduationYear: Number(graduationYear),
          highSchoolRank: highSchoolRank.trim() || undefined,
          admittedTo,
          examScope,
          isMentor,
          mentorNote: isMentor ? mentorNote : undefined,
          contactPhone: isMentor ? contactPhone : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Mezun profili oluşturulamadı.");
      showSuccess("Mezun profili eklendi.");
      reset();
      onCreated();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Mezun profili oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gurur Tablosuna Mezun Ekle">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Öğrenci</label>
          <StudentSearchSelect students={students} selectedStudentId={studentId} onSelect={setStudentId} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Mezuniyet Yılı</label>
            <input type="number" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Sınav Kapsamı</label>
            <select value={examScope} onChange={(e) => setExamScope(e.target.value as "YKS" | "LGS")} className={inputClass}>
              <option value="YKS">YKS</option>
              <option value="LGS">LGS</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Kabul Edildiği Üniversite/Bölüm
          </label>
          <input
            value={admittedTo}
            onChange={(e) => setAdmittedTo(e.target.value)}
            placeholder="Boğaziçi Üniversitesi — Bilgisayar Mühendisliği"
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Sıralama Rozeti (isteğe bağlı)
          </label>
          <input value={highSchoolRank} onChange={(e) => setHighSchoolRank(e.target.value)} placeholder="Kurum 1.si" className={inputClass} />
        </div>

        <label className="flex items-center gap-2 rounded-lg bg-cream-card px-3 py-2 text-xs font-medium text-espresso dark:bg-white/5 dark:text-cream">
          <input type="checkbox" checked={isMentor} onChange={(e) => setIsMentor(e.target.checked)} className="h-3.5 w-3.5" />
          <Handshake className="h-3.5 w-3.5 text-brand-600" /> Mentorluk vermeye gönüllü
        </label>

        {isMentor && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3 overflow-hidden">
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Mentorluk Notu</label>
              <textarea
                value={mentorNote}
                onChange={(e) => setMentorNote(e.target.value)}
                rows={2}
                placeholder="Sayısal netleri artırma ve YKS kaygısı üzerine destek veriyor."
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                İletişim Telefonu (talep onaylanınca öğrenciye açılır)
              </label>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="05XX XXX XX XX" className={inputClass} />
            </div>
          </motion.div>
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitting ? "Ekleniyor..." : "Gurur Tablosuna Ekle"}
      </button>
    </Modal>
  );
}

function AlumniCard({ alumnus, onDeleted }: { alumnus: AlumniProfile; onDeleted: () => void }) {
  const { showError, showSuccess } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/alumni/${alumnus.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Silinemedi.");
      showSuccess("Mezun profili kaldırıldı.");
      onDeleted();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      className="flex flex-col rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarInitials name={alumnus.name} className="h-11 w-11 shrink-0 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-espresso dark:text-cream">{alumnus.name}</p>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">{alumnus.graduationYear} Mezunu</p>
          </div>
        </div>
        {!confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-espresso-muted transition hover:bg-red-100 hover:text-red-600 dark:text-cream/40 dark:hover:bg-red-500/20 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {confirmDelete ? (
        <div className="mb-3 space-y-2 rounded-xl bg-amber-50 p-3 text-xs dark:bg-amber-500/10">
          <p className="text-amber-900 dark:text-amber-300">Gurur tablosundan kaldırılsın mı? Öğrencinin kendi kaydı etkilenmez.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 rounded-lg border border-hairline py-1.5 font-medium text-espresso-muted hover:bg-white dark:border-white/10 dark:text-cream/40"
            >
              Vazgeç
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-lg bg-red-600 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "..." : "Kaldır"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {alumnus.highSchoolRank && (
            <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium text-brand-800 dark:bg-brand-600/20 dark:text-brand-300">
              <Trophy className="h-3 w-3" /> {alumnus.highSchoolRank}
            </span>
          )}
          <div className="mb-3 flex-1 rounded-xl bg-cream-card p-2.5 dark:bg-white/5">
            <p className="flex items-start gap-1.5 text-xs font-medium text-espresso dark:text-cream">
              <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {alumnus.admittedTo}
            </p>
            <span className="mt-1.5 inline-block rounded-full bg-white px-2 py-0.5 text-[9px] font-medium text-espresso-muted dark:bg-white/10 dark:text-cream/50">
              {alumnus.examScope} Kapsamı
            </span>
          </div>
          {alumnus.isMentor && (
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-green-700 dark:text-green-400">
              <Handshake className="h-3.5 w-3.5" /> Mentorluk veriyor
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}

function MentorRequestsPanel({ requests, onResolved }: { requests: MentorRequestRow[]; onResolved: () => void }) {
  const { showError, showSuccess } = useToast();
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  async function resolve(id: string, status: "APPROVED" | "REJECTED") {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/admin/mentor-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Güncellenemedi.");
      showSuccess(status === "APPROVED" ? "Talep onaylandı — öğrenciye iletişim bilgisi açıldı." : "Talep reddedildi.");
      onResolved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Güncellenemedi.");
    } finally {
      setResolvingId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Inbox className="h-4 w-4 text-brand-600" /> Bekleyen Talepler ({pending.length})
        </h2>
        <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
          Mezun sisteme giriş yapmıyor — onaylamadan önce mezunla okul dışı bir kanaldan (telefon/WhatsApp) iletişime geçip teyit alın.
        </p>
        <div className="space-y-2">
          {pending.map((r) => (
            <div key={r.id} className="rounded-xl bg-cream-card p-3 dark:bg-white/5">
              <p className="text-sm font-medium text-espresso dark:text-cream">
                {r.requesterName} <span className="text-espresso-muted dark:text-cream/40">({r.requesterBranchName})</span> →{" "}
                <span className="text-brand-600">{r.mentorName}</span>
              </p>
              {r.message && <p className="mt-1 text-xs italic text-espresso-muted dark:text-cream/50">&quot;{r.message}&quot;</p>}
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => resolve(r.id, "APPROVED")}
                  disabled={resolvingId === r.id}
                  className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" /> Onayla
                </button>
                <button
                  onClick={() => resolve(r.id, "REJECTED")}
                  disabled={resolvingId === r.id}
                  className="flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso-muted hover:bg-white dark:border-white/10 dark:text-cream/40 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  <X className="h-3 w-3" /> Reddet
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Bekleyen talep yok.</p>}
        </div>
      </motion.div>

      {resolved.length > 0 && (
        <motion.div
          whileHover={{ scale: 1.005, y: -2 }}
          className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
        >
          <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">Geçmiş</h2>
          <div className="space-y-1.5">
            {resolved.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg bg-cream-card px-3 py-2 text-xs dark:bg-white/5">
                <span className="text-espresso dark:text-cream">
                  {r.requesterName} → {r.mentorName}
                </span>
                <span className={cn("font-medium", r.status === "APPROVED" ? "text-green-600" : "text-rose-600")}>
                  {r.status === "APPROVED" ? "Onaylandı" : "Reddedildi"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function AlumniNetworkTab() {
  const { showError } = useToast();
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [requests, setRequests] = useState<MentorRequestRow[]>([]);
  const [view, setView] = useState<"gallery" | "requests">("gallery");
  const [showMentorsOnly, setShowMentorsOnly] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  function loadAlumni() {
    fetch("/api/admin/alumni")
      .then((res) => res.json())
      .then((data) => setAlumni(data.profiles ?? []))
      .catch(() => showError("Mezun listesi yüklenemedi."));
  }

  function loadRequests() {
    fetch("/api/admin/mentor-requests")
      .then((res) => res.json())
      .then((data) => setRequests(data.requests ?? []))
      .catch(() => showError("Mentorluk talepleri yüklenemedi."));
  }

  useEffect(() => {
    loadAlumni();
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAlumni = showMentorsOnly ? alumni.filter((a) => a.isMentor) : alumni;
  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 rounded-full border border-hairline bg-white/70 p-1 dark:border-white/10 dark:bg-midnight-card/50">
          <button
            onClick={() => setView("gallery")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "gallery" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <Trophy className="h-3.5 w-3.5" /> Gurur Tablosu
          </button>
          <button
            onClick={() => setView("requests")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "requests" ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <Inbox className="h-3.5 w-3.5" /> Mentorluk Talepleri
            {pendingCount > 0 && (
              <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{pendingCount}</span>
            )}
          </button>
        </div>

        {view === "gallery" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMentorsOnly((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                showMentorsOnly
                  ? "bg-brand-600 text-white"
                  : "border border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
              )}
            >
              <Handshake className="h-3.5 w-3.5" /> Sadece Mentorlar
            </button>
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Plus className="h-3.5 w-3.5" /> Mezun Ekle
            </button>
          </div>
        )}
      </div>

      {view === "gallery" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {visibleAlumni.map((alumnus) => (
              <AlumniCard key={alumnus.id} alumnus={alumnus} onDeleted={loadAlumni} />
            ))}
          </AnimatePresence>
          {visibleAlumni.length === 0 && (
            <p className="col-span-full py-8 text-center text-xs text-espresso-muted dark:text-cream/40">
              Henüz gurur tablosuna eklenmiş bir mezun yok.
            </p>
          )}
        </div>
      ) : (
        <MentorRequestsPanel requests={requests} onResolved={loadRequests} />
      )}

      <AddAlumniModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} onCreated={loadAlumni} />
    </div>
  );
}
