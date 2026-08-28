"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Trophy, Handshake, Send, CheckCircle2, Clock, Phone } from "lucide-react";
import { AvatarInitials } from "@/components/principal/avatar-initials";
import { Modal } from "@/components/ui/modal";
import { useStudentScope } from "@/lib/student-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type AlumniProfile = {
  id: string;
  name: string;
  graduationYear: number;
  highSchoolRank: string | null;
  admittedTo: string;
  examScope: string;
  isMentor: boolean;
  mentorNote: string | null;
};

type MyRequest = { id: string; alumniProfileId: string; status: "PENDING" | "APPROVED" | "REJECTED"; mentorName: string; contactPhone: string | null };

const STATUS_BADGE: Record<MyRequest["status"], string> = {
  PENDING: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};
const STATUS_LABEL: Record<MyRequest["status"], string> = { PENDING: "Onay Bekliyor", APPROVED: "Onaylandı", REJECTED: "Reddedildi" };

function RequestModal({
  alumnus,
  onClose,
  onSent,
}: {
  alumnus: AlumniProfile | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!alumnus) return;
    setSending(true);
    try {
      const res = await fetch("/api/mentor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alumniProfileId: alumnus.id, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Talep gönderilemedi.");
      showSuccess("Mentorluk talebin gönderildi.");
      setMessage("");
      onSent();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Talep gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal isOpen={!!alumnus} onClose={onClose} title="Mentorluk Talebi Gönder">
      {alumnus && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-cream-card p-3 dark:bg-white/5">
            <AvatarInitials name={alumnus.name} className="h-10 w-10 text-sm" />
            <div>
              <p className="text-sm font-semibold text-espresso dark:text-cream">{alumnus.name}</p>
              <p className="text-[11px] text-espresso-muted dark:text-cream/40">{alumnus.admittedTo}</p>
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Kendini kısaca tanıt, neye ihtiyacın olduğunu yaz (isteğe bağlı)"
            rows={3}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {sending ? "Gönderiliyor..." : <><Send className="h-4 w-4" /> Talebi Gönder</>}
          </button>
        </div>
      )}
    </Modal>
  );
}

export function MentorshipTab() {
  const { studentId } = useStudentScope();
  const { showError } = useToast();
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [showMentorsOnly, setShowMentorsOnly] = useState(true);
  const [requestTarget, setRequestTarget] = useState<AlumniProfile | null>(null);

  useEffect(() => {
    fetch("/api/alumni")
      .then((res) => res.json())
      .then((data) => setAlumni(data.profiles ?? []))
      .catch(() => showError("Mezun listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadMyRequests() {
    if (!studentId) return;
    fetch(`/api/mentor-requests?studentId=${encodeURIComponent(studentId)}`)
      .then((res) => res.json())
      .then((data) => setMyRequests(data.requests ?? []))
      .catch(() => showError("Taleplerin yüklenemedi."));
  }

  useEffect(() => {
    loadMyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const visibleAlumni = showMentorsOnly ? alumni.filter((a) => a.isMentor) : alumni;
  const requestedIds = new Set(myRequests.map((r) => r.alumniProfileId));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Trophy className="h-4 w-4 text-brand-600" /> Mezun Gurur Tablosu
        </h2>
        <button
          onClick={() => setShowMentorsOnly((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
            showMentorsOnly ? "bg-brand-600 text-white" : "border border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
          )}
        >
          <Handshake className="h-3.5 w-3.5" /> Sadece Mentorlar
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {visibleAlumni.map((alumnus, index) => (
          <motion.div
            key={alumnus.id}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="flex flex-col rounded-3xl border border-hairline bg-white/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
          >
            <div className="mb-3 flex items-center gap-3">
              <AvatarInitials name={alumnus.name} className="h-11 w-11 text-sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-espresso dark:text-cream">{alumnus.name}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{alumnus.graduationYear} Mezunu</p>
              </div>
            </div>

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
              <>
                <p className="mb-2 text-[11px] italic text-espresso-muted dark:text-cream/40">&quot;{alumnus.mentorNote}&quot;</p>
                <button
                  onClick={() => setRequestTarget(alumnus)}
                  disabled={requestedIds.has(alumnus.id)}
                  className={cn(
                    "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-default",
                    requestedIds.has(alumnus.id)
                      ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                      : "bg-espresso text-cream hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                  )}
                >
                  {requestedIds.has(alumnus.id) ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Talep Gönderildi
                    </>
                  ) : (
                    <>
                      <Send className="h-3 w-3" /> Mentorluk Talebi Gönder
                    </>
                  )}
                </button>
              </>
            )}
          </motion.div>
        ))}
        {visibleAlumni.length === 0 && (
          <p className="col-span-full py-8 text-center text-xs text-espresso-muted dark:text-cream/40">Henüz mezun eklenmemiş.</p>
        )}
      </div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Clock className="h-4 w-4 text-brand-600" /> Taleplerim
        </h2>
        <div className="space-y-2">
          <AnimatePresence>
            {myRequests.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between gap-3 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso dark:text-cream">{r.mentorName}</p>
                  {r.status === "APPROVED" && r.contactPhone && (
                    <p className="flex items-center gap-1 text-[11px] text-green-700 dark:text-green-400">
                      <Phone className="h-3 w-3" /> {r.contactPhone}
                    </p>
                  )}
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", STATUS_BADGE[r.status])}>
                  {STATUS_LABEL[r.status]}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          {myRequests.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz bir mentorluk talebin yok.</p>}
        </div>
      </motion.div>

      <RequestModal alumnus={requestTarget} onClose={() => setRequestTarget(null)} onSent={loadMyRequests} />
    </div>
  );
}
