"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarPlus, CheckCircle2, ChevronRight, Clock, FolderOpen, LifeBuoy, Loader2, StickyNote } from "lucide-react";
import { invalidateCache, useCachedFetch } from "@/lib/client/cached-fetch";
import { useToast } from "@/lib/toast-context";
import { openStudent360 } from "@/lib/student-360-store";
import { cn } from "@/lib/utils";

type ReferralStatus = "PENDING" | "REVIEWED";
type Referral = {
  id: string;
  studentId: string;
  studentName: string;
  branchName: string;
  teacherName: string;
  reason: string;
  status: ReferralStatus;
  createdAt: string;
};
type GuidanceNoteEntry = { id: string; authorName: string; studentId: string; studentName: string; category: string; createdAt: string };

const FILTERS: { id: ReferralStatus | "ALL"; label: string }[] = [
  { id: "PENDING", label: "Bekleyen" },
  { id: "REVIEWED", label: "Görüldü" },
  { id: "ALL", label: "Tümü" },
];

// Rehberlik personasının ana ekranı — kullanıcı talebinin kök nedeni: bir
// öğretmenin "Rehberliğe Sevk Et" tuşu (bkz. components/teacher/tabs/
// risk-referral.tsx) VE Röntgen'in otomatik kırmızı-bölge tespiti (bkz.
// lib/server/xray/auto-referral.ts) GERÇEK bir GuidanceReferral kaydı
// oluşturuyordu ama BUNU OKUYAN hiçbir ekran yoktu — kayıt sessizce
// kayboluyordu. Bu ekran o kaydı GÖRÜNÜR kılan ilk ve tek yer.
export function ReferralQueue({
  onOpenStudent,
  onPlanMeeting,
}: {
  onOpenStudent?: (studentId: string) => void;
  onPlanMeeting?: (studentId: string) => void;
}) {
  const { showError, showSuccess } = useToast();
  const [filter, setFilter] = useState<ReferralStatus | "ALL">("PENDING");
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Önbellekli: filtre değiştirip geri dönmek ya da sekmeler arasında
  // gidip gelmek artık yeniden bekleme gerektirmiyor.
  const referralsUrl = `/api/guidance-referrals${filter === "ALL" ? "" : `?status=${filter}`}`;
  const referralsQuery = useCachedFetch<{ referrals: Referral[] }>(referralsUrl, { ttlMs: 30_000 });
  const [localReferrals, setLocalReferrals] = useState<Referral[] | null>(null);
  const referrals = localReferrals ?? referralsQuery.data?.referrals ?? null;
  const setReferrals = (fn: (prev: Referral[] | null) => Referral[] | null) =>
    setLocalReferrals(fn(referrals));
  useEffect(() => {
    setLocalReferrals(null);
  }, [referralsUrl, referralsQuery.data]);
  useEffect(() => {
    if (referralsQuery.failed) showError("Sevk kuyruğu yüklenemedi.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralsQuery.failed]);

  const notesQuery = useCachedFetch<{ notes: GuidanceNoteEntry[] }>("/api/guidance-notes?feed=true&limit=30", {
    ttlMs: 60_000,
  });
  const notes = notesQuery.failed ? [] : notesQuery.data?.notes ?? null;

  const pendingCount = useMemo(() => referrals?.filter((r) => r.status === "PENDING").length ?? 0, [referrals]);

  async function markReviewed(referral: Referral) {
    setMarkingId(referral.id);
    try {
      const res = await fetch(`/api/guidance-referrals/${referral.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REVIEWED" }),
      });
      if (!res.ok) throw new Error();
      setReferrals((prev) => (prev ? (filter === "PENDING" ? prev.filter((r) => r.id !== referral.id) : prev.map((r) => (r.id === referral.id ? { ...r, status: "REVIEWED" as const } : r))) : prev));
      // Sunucudaki gerçek durum değişti — önbellekteki sevk listeleri bayat.
      invalidateCache("/api/guidance-referrals");
      showSuccess(`${referral.studentName} görüldü olarak işaretlendi.`);
    } catch {
      showError("İşaretlenemedi.");
    } finally {
      setMarkingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 pb-16 pt-4 md:px-0">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-bold text-espresso dark:text-cream">
          <LifeBuoy className="h-5 w-5 text-brand-600" /> Sevk Kuyruğu
        </h1>
        <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">
          Öğretmenlerin ve Akademik Röntgen&apos;in otomatik tespitinin gönderdiği rehberlik sevkleri.
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              filter === f.id
                ? "bg-espresso text-cream dark:bg-brand-600"
                : "border border-hairline bg-white/70 text-espresso-muted hover:text-espresso dark:border-white/10 dark:bg-midnight-card/50 dark:text-cream/40 dark:hover:text-cream"
            )}
          >
            {f.label}
            {f.id === "PENDING" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        {referrals === null ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        ) : referrals.length === 0 ? (
          <p className="py-6 text-center text-xs text-espresso-muted dark:text-cream/40">Bu filtrede sevk yok.</p>
        ) : (
          <div className="space-y-2">
            {referrals.map((r, index) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-2xl px-3.5 py-3",
                  r.status === "PENDING" ? "bg-rose-50 dark:bg-rose-500/10" : "bg-cream-card dark:bg-white/5"
                )}
              >
                <div className="min-w-0">
                  <button
                    onClick={() => (onOpenStudent ? onOpenStudent(r.studentId) : openStudent360(r.studentId))}
                    className="text-left text-sm font-semibold text-espresso underline-offset-2 hover:underline dark:text-cream"
                  >
                    {r.studentName}
                  </button>
                  <p className="mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                    {r.branchName} · {r.teacherName} tarafından sevk edildi
                  </p>
                  <p className="mt-1 text-xs text-espresso dark:text-cream/80">{r.reason}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-espresso-muted dark:text-cream/30">
                    <Clock className="h-3 w-3" /> {new Date(r.createdAt).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                {/* ⚠️ Sevk kartı artık ÖLÜ DEĞİL: rehber sevki görünce iki şey
                    yapar — dosyayı açar ya da görüşme planlar. Eskiden tek
                    eylem "Görüldü İşaretle"ydi, yani sevk kapanıyor ama
                    hiçbir iş başlamıyordu. */}
                {onPlanMeeting && (
                  <button
                    onClick={() => onPlanMeeting(r.studentId)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-500"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" /> Görüşme Planla
                  </button>
                )}
                {onOpenStudent && (
                  <button
                    onClick={() => onOpenStudent(r.studentId)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[11px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/10"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> Dosyayı Aç
                  </button>
                )}
                {r.status === "PENDING" ? (
                  <button
                    onClick={() => markReviewed(r)}
                    disabled={markingId === r.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-espresso px-3 py-1.5 text-[11px] font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
                  >
                    {markingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    Görüldü İşaretle
                  </button>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[10.5px] font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" /> Görüldü
                  </span>
                )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        {/* ⚠️ ADI YANLIŞTI (Mert: "yönetim notları var, amacı ne bilmiyorum").
            Bu bölüm bir "yönetim" kaydı DEĞİL: kurumdaki SON GÖRÜŞME NOTU
            hareketlerinin akışı — kim, hangi öğrenci için not yazmış.
            Not METNİ burada bilerek gösterilmez (gizlilik seviyeleri
            öğrenci bazlıdır, akışta toplu ifşa olmamalı); satıra basınca
            o öğrencinin dosyası açılır ve notlar orada okunur. */}
        <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
          <StickyNote className="h-3.5 w-3.5" /> Son Görüşme Hareketleri
        </h2>
        <p className="mb-3 text-[11px] leading-snug text-espresso-muted dark:text-cream/40">
          Kurumda son yazılan görüşme notları — kim, kimin için yazmış. Notun içeriği burada gösterilmez; satıra basınca o
          öğrencinin dosyası açılır.
        </p>
        {notes === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-2 text-xs text-espresso-muted dark:text-cream/40">Henüz not yok.</p>
        ) : (
          <div className="space-y-1.5">
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => onOpenStudent?.(n.studentId)}
                disabled={!onOpenStudent}
                className="flex min-h-[40px] w-full items-center gap-2 rounded-lg bg-cream-card px-2.5 py-1.5 text-left text-xs transition hover:bg-cream-muted disabled:cursor-default dark:bg-white/5 dark:hover:bg-white/10"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    <span className="font-medium text-espresso dark:text-cream">{n.studentName}</span>{" "}
                    <span className="text-espresso-muted dark:text-cream/40">· {n.authorName}</span>
                  </span>
                  <span className="block text-[10px] text-espresso-muted dark:text-cream/35">
                    {new Date(n.createdAt).toLocaleString("tr-TR")}
                  </span>
                </span>
                {onOpenStudent && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-espresso-muted dark:text-cream/30" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
