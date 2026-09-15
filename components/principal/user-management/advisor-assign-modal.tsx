"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, UserCheck, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// DANIŞMAN ATAMA — Student.advisorTeacherId'yi atayan TEK ekran.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): "bu danışmanlık sistemde nasıl seçiliyor
// bunu ben bile bilmiyorum" — cevap "hiçbir yerden"di. Ayrıntı ve iki somut
// sonucu app/api/admin/student-advisors/route.ts üstünde yazılı.
//
// Akış bilinçli olarak TOPLU: 500 öğrencilik bir kurumda danışmanı tek tek
// atamak pratikte yapılmaz ve alan boş kalır (bugüne kadar olan tam da bu).
// Şube seç → danışmanı olmayanları göster → hepsini seç → tek öğretmene ata.
// ----------------------------------------------------------------------------

type Row = {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
  advisorId: string | null;
  advisorName: string | null;
};
type TeacherOption = { id: string; name: string; subject: string };

export function AdvisorAssignModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showError, showSuccess } = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [advisorId, setAdvisorId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRows(null);
    setSelected(new Set());
    fetch(`/api/admin/student-advisors${onlyMissing ? "?onlyMissing=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
  }, [isOpen, onlyMissing, showError]);

  useEffect(() => {
    if (!isOpen || teachers.length > 0) return;
    fetch("/api/teachers")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setTeachers(
          (d.teachers ?? []).map((t: { id: string; firstName: string; lastName: string; subject: string }) => ({
            id: t.id,
            name: `${t.firstName} ${t.lastName}`,
            subject: t.subject,
          }))
        )
      )
      .catch(() => showError("Öğretmen listesi yüklenemedi."));
  }, [isOpen, teachers.length, showError]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return rows ?? [];
    return (rows ?? []).filter(
      (r) =>
        r.name.toLocaleLowerCase("tr-TR").includes(q) || (r.branchName ?? "").toLocaleLowerCase("tr-TR").includes(q)
    );
  }, [rows, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assign() {
    if (selected.size === 0 || !advisorId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/student-advisors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected], advisorTeacherId: advisorId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Atama yapılamadı.");
      showSuccess(`${data.updated} öğrenciye danışman atandı.`);
      setSelected(new Set());
      setRows((prev) => (prev ?? []).filter((r) => !selected.has(r.id) || !onlyMissing));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atama yapılamadı.");
    } finally {
      setSaving(false);
    }
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Danışman Atama">
      <p className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-[11.5px] leading-snug text-brand-800 dark:bg-brand-600/10 dark:text-brand-200">
        Danışman öğretmen, o öğrencinin rehberlik takibinden sorumlu kişidir. Röntgen&apos;in otomatik sevkleri de
        danışmana gider — danışmanı olmayan öğrencide o sevkler hiçbir yere ulaşmaz.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setOnlyMissing((v) => !v)}
          className={cn(
            "flex min-h-[40px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition",
            onlyMissing ? "bg-espresso text-cream dark:bg-brand-600" : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/45"
          )}
        >
          <Users className="h-3.5 w-3.5" /> {onlyMissing ? "Danışmansızlar" : "Tümü"}
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Öğrenci veya şube ara..."
            className="min-h-[40px] w-full rounded-xl border border-hairline bg-white pl-9 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
        </div>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl bg-cream-card px-3 py-8 text-center text-xs text-espresso-muted dark:bg-white/5 dark:text-cream/40">
          {onlyMissing ? "Danışmanı olmayan öğrenci yok — hepsi atanmış." : "Öğrenci bulunamadı."}
        </p>
      ) : (
        <>
          <button
            onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.id)))}
            className="mb-1.5 text-[11px] font-semibold text-brand-700 underline dark:text-brand-300"
          >
            {allVisibleSelected ? "Seçimi kaldır" : `Görünen ${filtered.length} öğrencinin hepsini seç`}
          </button>
          <div className="max-h-64 overflow-y-auto rounded-xl border border-hairline dark:border-white/10">
            {filtered.map((r) => (
              <label
                key={r.id}
                className="flex min-h-[44px] cursor-pointer items-center gap-2.5 border-b border-hairline px-3 last:border-0 hover:bg-cream-card dark:border-white/5 dark:hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                  className="h-4 w-4 shrink-0 accent-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-espresso dark:text-cream">{r.name}</span>
                  <span className="block truncate text-[11px] text-espresso-muted dark:text-cream/40">
                    {r.branchName ?? "Şubesiz"}
                    {r.advisorName ? ` · Danışman: ${r.advisorName}` : " · danışman yok"}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 space-y-2">
        <select
          value={advisorId}
          onChange={(e) => setAdvisorId(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-hairline bg-white px-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          <option value="">Danışman öğretmen seçin...</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} — {t.subject}
            </option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={saving || selected.size === 0 || !advisorId}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          {saving ? "Atanıyor..." : selected.size === 0 ? "Öğrenci seçin" : `${selected.size} öğrenciye ata`}
        </button>
      </div>
    </Modal>
  );
}
