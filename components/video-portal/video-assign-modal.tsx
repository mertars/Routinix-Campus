"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Send, Loader2, Users, GraduationCap, CheckCircle2, Sparkles, Target } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { VideoLesson } from "@/components/video-portal/video-portal-panel";

type RosterStudent = { id: string; firstName: string; lastName: string; branchId: string; branchName: string; grade: number };

// Akademik Röntgen entegrasyonu (2026-09-04) — kullanıcı talebi: "her
// öğrenciye öneriler olmalı, bu öğrenciye bunu atabilirsiniz". Videonun
// konusunu Röntgen'in müfredat ağacındaki alt konularla eşleştirip o
// konuda kırmızı bölgede (masteryScore < 30) olan öğrencileri döndüren
// /api/videos/[id]/recommendations'tan gelir (bkz. o dosyadaki gerekçe).
type Recommendation = {
  id: string;
  firstName: string;
  lastName: string;
  branchName: string;
  grade: number;
  masteryScore: number;
  subtopicName: string;
};
type RecommendationsResponse = { supported: boolean; matchedTopics: string[]; students: Recommendation[] };

// "Ata" — gerçek öğrenci listesini çeker, seçilenleri POST
// /api/videos/[id]/assign'a gönderir (VideoAssignment satırları olarak
// KALICI kaydedilir). Kullanıcı isteği: "istediği zaman istediği
// öğrencinin paneline tek tuşla atayacak" — o yüzden hedef seçimi TEK
// TIKLA da yapılabilsin diye şube/sınıf hızlı seçenekleri var
// (xray-assignment-target-picker.tsx ile AYNI ilke, ama burada tekil bir
// "seçili öğrenci" bağlamı olmadığı için çoklu-seçim/checkbox tabanlı
// ayrı bir tasarım).
export function VideoAssignModal({ isOpen, onClose, video }: { isOpen: boolean; onClose: () => void; video: VideoLesson | null }) {
  const { showToast, showError } = useToast();
  const [roster, setRoster] = useState<RosterStudent[] | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendationsResponse | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setQuery("");
    if (roster) return;
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data) => {
        const students: RosterStudent[] = (data.students ?? []).map(
          (s: { id: string; firstName: string; lastName: string; branchId: string; branchName: string; grade: number }) => ({
            id: s.id,
            firstName: s.firstName,
            lastName: s.lastName,
            branchId: s.branchId,
            branchName: s.branchName,
            grade: s.grade,
          })
        );
        setRoster(students);
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !video) {
      setRecommendations(null);
      return;
    }
    fetch(`/api/videos/${encodeURIComponent(video.id)}/recommendations`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: RecommendationsResponse) => setRecommendations(data))
      .catch(() => setRecommendations({ supported: false, matchedTopics: [], students: [] }));
  }, [isOpen, video]);

  function selectRecommended() {
    if (!recommendations) return;
    setSelected((prev) => new Set([...prev, ...recommendations.students.map((s) => s.id)]));
  }

  const filtered = useMemo(() => {
    if (!roster) return [];
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q) || s.branchName.toLocaleLowerCase("tr-TR").includes(q));
  }, [roster, query]);

  const gradeMatch = useMemo(() => (roster ?? []).filter((s) => video && s.grade === video.grade), [roster, video]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectGrade() {
    setSelected(new Set(gradeMatch.map((s) => s.id)));
  }

  async function handleSend() {
    if (selected.size === 0 || !video) return;
    setSending(true);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected] }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      showToast("success", `"${video.title}" ${data.assignedCount} öğrenciye atandı.`);
      onClose();
    } catch {
      showError("Atama yapılamadı.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={video ? `"${video.title}" — Öğrenciye Ata` : "Öğrenciye Ata"} variant="center" widthClassName="max-w-lg">
      <div className="space-y-3">
        {video && (
          <button
            onClick={selectGrade}
            className="flex w-full items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/5 px-3 py-2.5 text-left text-xs font-medium text-violet-700 transition hover:bg-violet-500/10 dark:border-violet-400/20 dark:text-violet-300"
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
            {video.grade}. Sınıfın tamamını seç ({gradeMatch.length} öğrenci)
          </button>
        )}

        {/* Röntgen Önerisi — bu konuda kırmızı bölgede olan (henüz bu
            videoyu almamış) öğrenciler. Sadece Matematik/Fizik için veri
            var (bkz. /api/videos/[id]/recommendations); eşleşme yoksa ya
            da ders desteklenmiyorsa bölüm SESSİZCE gizlenir. */}
        {recommendations?.supported && recommendations.students.length > 0 && (
          <div className="space-y-2 rounded-xl border border-rose-400/25 bg-rose-500/5 p-3 dark:border-rose-400/20 dark:bg-rose-500/10">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                <Target className="h-3.5 w-3.5" /> Röntgen Önerisi — {recommendations.students.length} öğrenci bu konuda zayıf
              </p>
              <button onClick={selectRecommended} className="shrink-0 text-[10.5px] font-semibold text-rose-700 underline-offset-2 hover:underline dark:text-rose-300">
                Tümünü ekle
              </button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {recommendations.students.map((s) => {
                const isSelected = selected.has(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggle(s.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition",
                      isSelected ? "bg-rose-500/15" : "hover:bg-rose-500/10"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-espresso dark:text-cream">
                        {s.firstName} {s.lastName}
                      </span>
                      <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">
                        {s.branchName} · {s.grade}. Sınıf
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                        {s.subtopicName} · %{s.masteryScore}
                      </span>
                      {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {recommendations?.supported && recommendations.matchedTopics.length > 0 && recommendations.students.length === 0 && (
          <p className="flex items-center gap-1.5 rounded-xl border border-hairline bg-white/40 px-3 py-2 text-[10.5px] text-espresso-muted dark:border-white/10 dark:bg-white/5 dark:text-cream/40">
            <Sparkles className="h-3.5 w-3.5 shrink-0" /> Bu konuda şu an kırmızı bölgede öğrenci yok.
          </p>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Öğrenci veya şube ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-violet-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        {!roster ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-violet-600" />
          </div>
        ) : (
          <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
            {filtered.map((s) => {
              const isSelected = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition",
                    isSelected ? "bg-violet-500/10" : "hover:bg-cream-card dark:hover:bg-white/5"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-espresso dark:text-cream">
                      {s.firstName} {s.lastName}
                    </span>
                    <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">
                      {s.branchName} · {s.grade}. Sınıf
                    </span>
                  </span>
                  {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />}
                </button>
              );
            })}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={selected.size === 0 || sending}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {selected.size > 0 ? `${selected.size} Öğrenciye Ata` : "Öğrenci Seç"}
        </button>
        <p className="flex items-center gap-1.5 text-[10px] text-espresso-muted dark:text-cream/40">
          <Users className="h-3 w-3" /> Öğrenci daha önce bu videoyu almışsa atlanır, yeniden atanmaz.
        </p>
      </div>
    </Modal>
  );
}
