"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LifeBuoy, Loader2, CheckCircle2, StickyNote, Clock } from "lucide-react";
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
type GuidanceNoteEntry = { id: string; authorName: string; studentName: string; category: string; createdAt: string };

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
export function ReferralQueue() {
  const { showError, showSuccess } = useToast();
  const [filter, setFilter] = useState<ReferralStatus | "ALL">("PENDING");
  const [referrals, setReferrals] = useState<Referral[] | null>(null);
  const [notes, setNotes] = useState<GuidanceNoteEntry[] | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    setReferrals(null);
    const qs = filter === "ALL" ? "" : `?status=${filter}`;
    fetch(`/api/guidance-referrals${qs}`)
      .then((res) => res.json())
      .then((data) => setReferrals(data.referrals ?? []))
      .catch(() => showError("Sevk kuyruğu yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    fetch("/api/guidance-notes?feed=true&limit=30")
      .then((res) => res.json())
      .then((data) => setNotes(data.notes ?? []))
      .catch(() => setNotes([]));
  }, []);

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
      setReferrals((prev) => (prev ? (filter === "PENDING" ? prev.filter((r) => r.id !== referral.id) : prev.map((r) => (r.id === referral.id ? { ...r, status: "REVIEWED" } : r))) : prev));
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
                    onClick={() => openStudent360(r.studentId)}
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
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
          <StickyNote className="h-3.5 w-3.5" /> Yönetim Notları
        </h2>
        {notes === null ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-2 text-xs text-espresso-muted dark:text-cream/40">Henüz not yok.</p>
        ) : (
          <div className="space-y-1.5">
            {notes.map((n) => (
              <div key={n.id} className="rounded-lg bg-cream-card px-2.5 py-1.5 text-xs dark:bg-white/5">
                <span className="font-medium text-espresso dark:text-cream">{n.authorName}</span>{" "}
                <span className="text-espresso-muted dark:text-cream/40">
                  , {n.studentName} için not ekledi · {new Date(n.createdAt).toLocaleString("tr-TR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
