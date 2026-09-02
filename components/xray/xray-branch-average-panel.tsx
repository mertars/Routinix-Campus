"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { XRAY_SUBJECTS } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type BranchOption = { id: string; name: string; grade: number };
type StudentRow = { studentId: string; name: string; average: number | null; delta: number | null };
type BranchAverageResponse = {
  branchName: string;
  branchAverage: number;
  studentCount: number;
  testedCount: number;
  subtopicBreakdown: { subtopicId: string; name: string; average: number }[];
  students: StudentRow[];
};

function scoreTone(score: number): string {
  if (score >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 30) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

function scoreBar(score: number): string {
  if (score >= 60) return "bg-emerald-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

// Faz Q — kullanıcı talebi: "sınıf ortalamasını ekle ama sınıflara özel
// ayrı panel gerekir" — bu, öğrenci-bazlı sonuç panelinin (xray-results-
// panel.tsx) İÇİNDE değil, üst bar menüsünde (XrayTopBar principalTools)
// BAĞIMSIZ bir modal. "Akran kıyaslaması yok" ilkesi korunur: öğrenci
// listesi İSME göre sıralanır (başarıya göre DEĞİL), her satırda sadece
// KENDİ delta'sı (şube ortalamasına göre fark) görünür — bir liderlik
// tablosu değildir.
export function XrayBranchAveragePanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError } = useToast();
  const [branches, setBranches] = useState<BranchOption[] | null>(null);
  const [branchId, setBranchId] = useState("");
  const [subject, setSubject] = useState(XRAY_SUBJECTS[0]);
  const [data, setData] = useState<BranchAverageResponse | null>(null);

  useEffect(() => {
    if (!isOpen || branches) return;
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((json) => {
        const byBranch = new Map<string, BranchOption>();
        for (const s of json.students ?? []) {
          if ((s.grade ?? 0) < 9) continue;
          if (!byBranch.has(s.branchId)) byBranch.set(s.branchId, { id: s.branchId, name: s.branchName, grade: s.grade });
        }
        const list = [...byBranch.values()].sort((a, b) => (a.grade - b.grade) || a.name.localeCompare(b.name, "tr-TR"));
        setBranches(list);
        setBranchId((current) => current || list[0]?.id || "");
      })
      .catch(() => showError("Şube listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !branchId) return;
    setData(null);
    fetch(`/api/xray/branch-average?branchId=${encodeURIComponent(branchId)}&subject=${encodeURIComponent(subject)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((json) => setData(json))
      .catch(() => showError("Şube ortalaması yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, branchId, subject]);

  const sortedStudents = useMemo(() => (data ? [...data.students].sort((a, b) => a.name.localeCompare(b.name, "tr-TR")) : []), [data]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Şube Ortalamaları" variant="center" widthClassName="max-w-2xl">
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {!branches && <option>Yükleniyor...</option>}
          {branches?.length === 0 && <option>Şube bulunamadı</option>}
          {branches?.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.grade}. Sınıf)
            </option>
          ))}
        </select>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs text-espresso outline-none focus:border-sky-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
        >
          {XRAY_SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {!data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl bg-cream-card p-4 dark:bg-white/5">
            <div className={cn("text-4xl font-bold", scoreTone(data.branchAverage))}>%{data.branchAverage}</div>
            <div className="text-[11px] text-espresso-muted dark:text-cream/40">
              <p className="font-semibold text-espresso dark:text-cream">{data.branchName} ortalaması</p>
              <p className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {data.testedCount}/{data.studentCount} öğrenci test edildi
              </p>
            </div>
          </div>

          {data.subtopicBreakdown.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Konu Bazlı Şube Ortalaması</p>
              <div className="max-h-[30vh] space-y-2 overflow-y-auto pr-1">
                {data.subtopicBreakdown.map((s) => (
                  <div key={s.subtopicId}>
                    <div className="mb-0.5 flex items-center justify-between text-[11px]">
                      <span className="text-espresso-muted dark:text-cream/50">{s.name}</span>
                      <span className={cn("font-semibold", scoreTone(s.average))}>%{s.average}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-cream-muted dark:bg-white/10">
                      <div className={cn("h-full rounded-full", scoreBar(s.average))} style={{ width: `${s.average}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">Öğrenciler</p>
            <div className="max-h-[30vh] space-y-1 overflow-y-auto pr-1">
              {sortedStudents.map((s) => (
                <div key={s.studentId} className="flex items-center justify-between rounded-lg bg-white/50 px-2.5 py-1.5 text-[11px] dark:bg-midnight-card/40">
                  <span className="text-espresso dark:text-cream">{s.name}</span>
                  {s.average === null ? (
                    <span className="text-espresso-muted/60 dark:text-cream/30">Test edilmedi</span>
                  ) : (
                    <span className={cn("font-semibold", scoreTone(s.average))}>
                      %{s.average} {s.delta !== null && <span className="text-espresso-muted/70 dark:text-cream/30">({s.delta >= 0 ? "+" : ""}{s.delta})</span>}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
