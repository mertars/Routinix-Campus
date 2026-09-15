"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, LineChart, Loader2, NotebookPen, Search, Send, UserRound } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { openStudent360 } from "@/lib/student-360-store";
import { StudentDossier } from "@/components/guidance/student-dossier";
import { cn } from "@/lib/utils";

// ÖĞRENCİ TAKİBİ — rehberliğin ana çalışma ekranı.
//
// ⚠️ NEDEN VAR (2026-09-15 denetimi): rehberlik rolü `POST /api/guidance-notes`
// çağırma YETKİSİNE sahipti ama bunu yapabileceği HİÇBİR EKRAN yoktu —
// not yazan tek arayüzler yönetici tarafındaydı. Yani işi görüşme yapıp
// kayıt tutmak olan rolün, kayıt tutacak yeri yoktu.
//
// Ekranın kurgusu "liste + detay": solda kiminle ilgilenilmesi gerektiği
// (açık sevkler ve en uzun süredir görüşülmeyenler önce), sağda seçili
// öğrencinin görüşme geçmişi ve yeni not kutusu.

type OpenReferral = { id: string; reason: string; createdAt: string; teacherName: string };
type GuidanceStudent = {
  id: string;
  name: string;
  studentNumber: string;
  branchName: string;
  grade: number | null;
  noteCount: number;
  lastNoteAt: string | null;
  openReferrals: OpenReferral[];
};
type NoteEntry = {
  id: string;
  note: string;
  category: string;
  confidentialityLevel: string;
  authorName: string;
  createdAt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  ACADEMIC: "Akademik",
  BEHAVIORAL: "Davranış",
  CAREER: "Kariyer",
  FAMILY: "Aile",
  HEALTH: "Sağlık",
  OTHER: "Diğer",
};

const CONFIDENTIALITY_LABEL: Record<string, string> = {
  OPEN: "Herkese açık",
  RESTRICTED: "Kısıtlı",
  CONFIDENTIAL: "Gizli",
};

function sinceLabel(iso: string | null): string {
  if (!iso) return "hiç görüşülmemiş";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "bugün görüşüldü";
  if (days === 1) return "dün görüşüldü";
  return `${days} gün önce görüşüldü`;
}

export function StudentFocusTab({
  onNavigate,
}: {
  /** Dosyadaki eylem tuşları başka sekmeye geçirir ve öğrenciyi oraya taşır —
   *  rehber "bu öğrenciye program yazayım" dediğinde onu tekrar seçtirmek
   *  gereksiz bir adım olurdu. */
  onNavigate?: (tab: "meetings" | "program", studentId: string) => void;
}) {
  const { showError, showSuccess } = useToast();
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<GuidanceStudent[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Not kaydedilince dosya (zaman tüneli) tazelensin.
  const [dossierKey, setDossierKey] = useState(0);
  const [notes, setNotes] = useState<NoteEntry[] | null>(null);

  const [draft, setDraft] = useState("");
  const [category, setCategory] = useState("ACADEMIC");
  const [confidentiality, setConfidentiality] = useState("RESTRICTED");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/guidance/students${query.trim().length >= 2 ? `?q=${encodeURIComponent(query.trim())}` : ""}`, {
        signal: controller.signal,
      })
        .then((r) => r.json())
        .then((d) => setStudents(d.students ?? []))
        .catch(() => {
          if (!controller.signal.aborted) showError("Öğrenci listesi yüklenemedi.");
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const selected = useMemo(() => students?.find((s) => s.id === selectedId) ?? null, [students, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setNotes(null);
      return;
    }
    setNotes(null);
    fetch(`/api/guidance-notes?studentId=${encodeURIComponent(selectedId)}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? []))
      .catch(() => showError("Görüşme geçmişi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function saveNote() {
    if (!selectedId || !draft.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/guidance-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: selectedId,
          note: draft.trim(),
          category,
          confidentialityLevel: confidentiality,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Not kaydedilemedi.");
      setNotes((prev) => [data.guidanceNote, ...(prev ?? [])]);
      setDraft("");
      showSuccess("Görüşme notu kaydedildi.");
      // Listedeki "son görüşme" bilgisi tazelensin.
      setStudents((prev) =>
        prev?.map((s) =>
          s.id === selectedId ? { ...s, noteCount: s.noteCount + 1, lastNoteAt: new Date().toISOString() } : s
        ) ?? prev
      );
    } catch (error) {
      showError(error instanceof Error ? error.message : "Not kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      {/* SOL: kiminle ilgilenmeli */}
      <div className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="İsim veya öğrenci no ara..."
            className="min-h-[44px] w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
        </div>

        {students === null && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-espresso-muted dark:text-cream/40" />
          </div>
        )}

        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {students?.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={cn(
                "flex w-full min-h-[44px] items-start gap-2 rounded-xl px-2.5 py-2 text-left transition",
                selectedId === s.id
                  ? "bg-brand-500/12 ring-1 ring-brand-500/40"
                  : "hover:bg-cream-card dark:hover:bg-white/5"
              )}
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cream-muted text-espresso-muted dark:bg-white/[0.07] dark:text-cream/45">
                <UserRound className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-espresso dark:text-cream">{s.name}</span>
                <span className="block truncate text-[11px] text-espresso-muted dark:text-cream/40">
                  {s.branchName} · {sinceLabel(s.lastNoteAt)}
                </span>
              </span>
              {s.openReferrals.length > 0 && (
                <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-full bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  {s.openReferrals.length}
                </span>
              )}
            </button>
          ))}
          {students?.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>
          )}
        </div>
      </div>

      {/* SAĞ: seçili öğrencinin görüşme dosyası */}
      <div className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        {!selected ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/30">
              <NotebookPen className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-espresso dark:text-cream">Bir öğrenci seçin</p>
            <p className="max-w-[260px] text-[11.5px] leading-snug text-espresso-muted dark:text-cream/40">
              Soldaki listede açık sevki olanlar ve en uzun süredir görüşülmeyenler önce gelir.
            </p>
          </div>
        ) : (
          <>
            {/* ⚠️ Künye, akademik özet, eylemler ve ZAMAN TÜNELİ artık tek
                bileşende (bkz. components/guidance/student-dossier.tsx).
                Buradaki eski başlık ve ayrı "notlar listesi" kaldırıldı:
                görüşme/not/program üç ayrı yerde durdukça rehber öğretmen
                geçmişi parça parça aramak zorunda kalıyordu. Açık sevkler ve
                not yazma kutusu, dosyanın özet ile geçmiş ARASINDAKİ
                yuvasına giriyor. */}
            <StudentDossier
              studentId={selected.id}
              refreshKey={dossierKey}
              onPlanMeeting={() => onNavigate?.("meetings", selected.id)}
              onWriteProgram={() => onNavigate?.("program", selected.id)}
            >
            {selected.openReferrals.length > 0 && (
              <div className="mb-4 space-y-1.5">
                {selected.openReferrals.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border-l-4 border-rose-500 bg-rose-50/60 px-3 py-2 dark:bg-rose-500/10"
                  >
                    <p className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      Açık sevk · {r.teacherName}
                    </p>
                    <p className="text-[11.5px] text-espresso dark:text-cream">{r.reason}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Yeni görüşme notu */}
            <div className="mb-4 rounded-2xl border border-hairline p-3 dark:border-white/10">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="Görüşme notu — ne konuşuldu, ne kararlaştırıldı?"
                className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-h-[40px] rounded-lg border border-hairline bg-white px-2.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <select
                  value={confidentiality}
                  onChange={(e) => setConfidentiality(e.target.value)}
                  className="min-h-[40px] rounded-lg border border-hairline bg-white px-2.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  {Object.entries(CONFIDENTIALITY_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  onClick={saveNote}
                  disabled={!draft.trim() || saving}
                  className="ml-auto flex min-h-[40px] items-center gap-1.5 rounded-lg bg-espresso px-3.5 text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Kaydet
                </button>
              </div>
              <p className="mt-1.5 text-[10.5px] text-espresso-muted dark:text-cream/35">
                &quot;Gizli&quot; notlar yönetici akışında görünmez; veliye hiçbir notun metni gösterilmez.
              </p>
            </div>

            </StudentDossier>
          </>
        )}
      </div>
    </div>
  );
}
