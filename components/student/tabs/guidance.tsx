"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HeartHandshake, Send, Clock, Loader2 } from "lucide-react";
import { DAYS_OF_WEEK } from "@/lib/mock-data";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AppointmentStatus = "PENDING" | "APPROVED" | "REJECTED";
type AppointmentEntry = { id: string; topic: string; day: string; slot: string; status: AppointmentStatus; requestedAt: string; teacher: { firstName: string; lastName: string } };

const REASONS = ["Sınav Kaygısı", "Motivasyon", "Ders/Bölüm Seçimi", "Kişisel Gelişim", "Diğer"];

const STATUS_BADGE: Record<AppointmentStatus, string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Onay Bekliyor",
  APPROVED: "Onaylandı",
  REJECTED: "Reddedildi",
};

type Counselor = { id: string; firstName: string; lastName: string };

export function GuidanceTab() {
  const { studentId } = useStudentScope();
  const { showError, showSuccess } = useToast();
  const [reason, setReason] = useState(REASONS[0]);
  const [day, setDay] = useState<string>(DAYS_OF_WEEK[0]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [myRequests, setMyRequests] = useState<AppointmentEntry[]>([]);
  const [counselor, setCounselor] = useState<Counselor | null>(null);

  useEffect(() => {
    fetch("/api/teachers?subject=Rehberlik")
      .then((res) => res.json())
      .then((data) => setCounselor(data.teachers?.[0] ?? null))
      .catch(() => showError("Rehberlik uzmanı bilgisi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadRequests() {
    if (!counselor) return;
    try {
      const res = await fetch(`/api/appointments?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      const mine = (data.appointments ?? []).filter(
        (a: AppointmentEntry & { teacherId?: string }) => a.teacherId === counselor.id
      );
      setMyRequests(mine);
    } catch {
      showError("Talepler yüklenemedi.");
    }
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, counselor]);

  async function submit() {
    if (!counselor) return;
    setSending(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          teacherId: counselor.id,
          topic: note.trim() ? `${reason} — ${note.trim()}` : reason,
          day,
          slot: "Uygun bir saat",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Talep gönderilemedi.");
      showSuccess("Rehberlik görüşme talebin gönderildi.");
      setNote("");
      loadRequests();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Talep gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <HeartHandshake className="h-4 w-4 text-brand-600" /> Rehberlik Görüşme Talebi
        </h2>
        <p className="mb-3 text-xs text-espresso-muted dark:text-cream/40">
          {counselor ? `${counselor.firstName} ${counselor.lastName}` : "Rehberlik uzmanı"} ile görüşmek istediğin konuyu seç.
        </p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={cn(
                "min-h-[34px] rounded-full px-3 text-xs font-medium transition",
                reason === r ? "bg-espresso text-cream dark:bg-brand-600" : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <select
          value={day}
          onChange={(event) => setDay(event.target.value)}
          className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          {DAYS_OF_WEEK.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Eklemek istediğin bir not (isteğe bağlı)"
          rows={3}
          className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />

        <button
          onClick={submit}
          disabled={sending}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Talebi Gönder
        </button>
      </motion.div>

      <motion.div whileHover={{ scale: 1.005, y: -2 }} className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Clock className="h-4 w-4 text-brand-600" /> Taleplerim
        </h2>
        <div className="space-y-2">
          {myRequests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-espresso dark:text-cream">{r.topic}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{r.day} · {new Date(r.requestedAt).toLocaleDateString("tr-TR")}</p>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_BADGE[r.status])}>{STATUS_LABEL[r.status]}</span>
            </div>
          ))}
          {myRequests.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz rehberlik talebin yok.</p>}
        </div>
      </motion.div>
    </div>
  );
}
