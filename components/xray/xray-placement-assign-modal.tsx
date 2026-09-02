"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ClipboardCheck, CheckCircle2, Clock, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { cn } from "@/lib/utils";
import type { XrayRosterStudent } from "@/components/xray/xray-results-panel";

type PlacementStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";
type StatusRow = { studentId: string; status: PlacementStatus; assignedAt: string };

const STATUS_META: Record<PlacementStatus, { label: string; className: string }> = {
  ASSIGNED: { label: "Bekliyor", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  IN_PROGRESS: { label: "Çözüyor", className: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  COMPLETED: { label: "Tamamlandı", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
};

// Faz Q — kullanıcı talebi: sınav ataması tek bir "seçili öğrenciye tıkla"
// eylemi olarak KALMASIN, "istediği öğrenciye atsın, atmadığı öğrencileri
// de göstersin" — dershaneye SÜREKLİ yeni öğrenci kaydolduğu için "kim hâlâ
// eksik" sorusu tek seferlik değil, DEVAM EDEN bir ihtiyaç. Bu menü, TÜM
// kurum roster'ını (zaten XrayResultsPanel'in props'unda var, ayrı bir
// fetch gerekmiyor) placement-assignments GET'in döndürdüğü durumla
// birleştirip "Atanmadı" öğrencileri öne çıkarır.
export function XrayPlacementAssignModal({
  isOpen,
  onClose,
  roster,
  subject,
}: {
  isOpen: boolean;
  onClose: () => void;
  roster: XrayRosterStudent[];
  subject: string;
}) {
  const { showError, showToast } = useToast();
  const [statuses, setStatuses] = useState<Map<string, StatusRow> | null>(null);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [onlyPending, setOnlyPending] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [bulkAssigning, setBulkAssigning] = useState(false);

  function load() {
    setStatuses(null);
    fetch(`/api/xray/placement-assignments?subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => setStatuses(new Map((data.statuses as StatusRow[]).map((s) => [s.studentId, s]))))
      .catch(() => showError("Sınav durumları yüklenemedi."));
  }

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subject]);

  const gradeOptions = useMemo(() => [...new Set(roster.map((s) => s.grade))].sort((a, b) => a - b), [roster]);

  const rows = useMemo(() => {
    if (!statuses) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    return roster
      .filter((s) => {
        if (q && !`${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q)) return false;
        if (gradeFilter && String(s.grade) !== gradeFilter) return false;
        if (onlyPending && statuses.has(s.id)) return false;
        return true;
      })
      .map((s) => ({ student: s, status: statuses.get(s.id) ?? null }));
  }, [roster, statuses, query, gradeFilter, onlyPending]);

  const pendingCount = useMemo(() => (statuses ? roster.filter((s) => !statuses.has(s.id)).length : 0), [roster, statuses]);

  async function assignOne(studentId: string) {
    setAssigningId(studentId);
    try {
      const res = await fetch("/api/xray/placement-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: { type: "student", studentId }, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atanamadı.");
      if (data.created === 0) showError("Bu öğrencinin sınıf seviyesi için soru havuzu boş.");
      load();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atanamadı.");
    } finally {
      setAssigningId(null);
    }
  }

  async function assignAllVisible() {
    const targets = rows.filter((r) => !r.status).map((r) => r.student.id);
    if (targets.length === 0) return;
    setBulkAssigning(true);
    try {
      let created = 0;
      for (const studentId of targets) {
        const res = await fetch("/api/xray/placement-assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target: { type: "student", studentId }, subject }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.created > 0) created++;
      }
      showToast("success", `${created} öğrenciye sınav atandı.`);
      load();
    } catch {
      showError("Toplu atama sırasında bir hata oluştu.");
    } finally {
      setBulkAssigning(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Seviye Belirleme Sınavı — Atama Menüsü" variant="center" widthClassName="max-w-2xl">
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
          {statuses && (pendingCount > 0 ? `${pendingCount} öğrenci henüz sınava girmedi — sonradan kayıt olanlar da burada otomatik görünür.` : "Tüm öğrencilere zaten sınav atanmış.")}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Öğrenci ara..."
              className="w-full rounded-lg border border-hairline bg-white py-1.5 pl-7 pr-2.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
            />
          </div>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          >
            <option value="">Tüm Sınıflar</option>
            {gradeOptions.map((g) => (
              <option key={g} value={g}>
                {g}. Sınıf
              </option>
            ))}
          </select>
          <button
            onClick={() => setOnlyPending((v) => !v)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition",
              onlyPending ? "bg-sky-500/15 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300" : "bg-cream-card text-espresso-muted hover:text-espresso dark:bg-white/5 dark:text-cream/40"
            )}
          >
            Sadece eksikler
          </button>
        </div>

        {onlyPending && rows.length > 0 && (
          <button
            onClick={assignAllVisible}
            disabled={bulkAssigning}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {bulkAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
            Listedeki {rows.length} Öğrenciye Ata
          </button>
        )}

        {!statuses && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        )}

        {statuses && rows.length === 0 && <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Eşleşen öğrenci yok.</p>}

        {statuses && rows.length > 0 && (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {rows.map(({ student, status }) => (
              <div key={student.id} className="flex items-center gap-2.5 rounded-xl border border-hairline bg-white/60 px-2.5 py-2 dark:border-white/10 dark:bg-midnight-card/40">
                <AvatarInitials name={`${student.firstName} ${student.lastName}`} className="h-8 w-8 shrink-0 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-espresso dark:text-cream">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">
                    {student.branchName} · {student.grade}. Sınıf
                  </p>
                </div>
                {status ? (
                  <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium", STATUS_META[status.status].className)}>
                    {status.status === "COMPLETED" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                    {STATUS_META[status.status].label}
                  </span>
                ) : (
                  <button
                    onClick={() => assignOne(student.id)}
                    disabled={assigningId === student.id}
                    className="flex shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-sky-700 transition hover:bg-sky-500/20 disabled:opacity-60 dark:text-sky-300"
                  >
                    {assigningId === student.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ClipboardCheck className="h-3 w-3" />}
                    Ata
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
