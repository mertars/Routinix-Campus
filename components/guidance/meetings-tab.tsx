"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarClock, CalendarPlus, Check, Loader2, Search, UserRound, UserX, Users, X, XCircle } from "lucide-react";
import { GUIDANCE_CATEGORY_LABEL } from "@/lib/guidance/categories";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// GÖRÜŞME TAKVİMİ — rehberliğin "kimle, ne zaman görüşeceğim" ekranı.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): "görüşme de açamıyor, programını kimle ne
// zaman görüşecek göremiyor". Rehberliğin işi görüşme yapmak; randevusunu
// göremeyen bir rehber öğretmen işini uygulama DIŞINDA (kağıt/ajanda)
// yürütmek zorunda kalıyordu ve o kayıt hiçbir yere bağlanmıyordu.
//
// "Gelmedi" ayrı bir durum: iptal edilen görüşmeyle gelmeyen öğrenci aynı
// şey değil — ikincisi takip gerektiren bir SİNYALDİR.
// ----------------------------------------------------------------------------

type Meeting = {
  id: string;
  scheduledAt: string;
  durationMin: number;
  topic: string;
  category: "ACADEMIC" | "PSYCHOLOGICAL" | "DISCIPLINARY";
  status: "PLANNED" | "DONE" | "NO_SHOW" | "CANCELLED";
  attendee: "STUDENT" | "PARENT" | "BOTH";
  outcomeNote: string | null;
  studentId: string;
  studentName: string;
  branchName: string | null;
};

type StudentOption = { id: string; name: string; branchName: string | null };

const CATEGORY_LABEL = GUIDANCE_CATEGORY_LABEL;

const ATTENDEE_LABEL: Record<Meeting["attendee"], string> = {
  STUDENT: "Öğrenci",
  PARENT: "Veli",
  BOTH: "Öğrenci + Veli",
};

const STATUS_STYLE: Record<Meeting["status"], { label: string; className: string }> = {
  PLANNED: { label: "Planlandı", className: "bg-brand-50 text-brand-700 dark:bg-brand-600/15 dark:text-brand-300" },
  DONE: { label: "Yapıldı", className: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" },
  NO_SHOW: { label: "Gelmedi", className: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  CANCELLED: { label: "İptal", className: "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40" },
};

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" });
}
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}
function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}
/** <input type="datetime-local"> için yerel saatli varsayılan: yarın 10:00. */
function defaultWhen(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewMeetingForm({
  onCreated,
  initialStudentId,
}: {
  onCreated: () => void;
  /** Başka sekmeden "bu öğrenciyle görüşme planla" denince gelir —
   *  form AÇIK ve öğrenci SEÇİLİ başlar (Mert: "sadece sekmeye atıyor"). */
  initialStudentId?: string | null;
}) {
  const { showError, showSuccess } = useToast();
  const [open, setOpen] = useState(!!initialStudentId);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [when, setWhen] = useState(defaultWhen);
  const [duration, setDuration] = useState(30);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState<Meeting["category"]>("ACADEMIC");
  // Veli görüşmesi de hep BİR ÖĞRENCİ hakkındadır; değişen sadece masaya
  // kimin oturduğu (bkz. schema.prisma > GuidanceMeeting.attendee).
  const [attendee, setAttendee] = useState<Meeting["attendee"]>("STUDENT");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || students.length > 0) return;
    // ⚠️ ?studentId= zorunlu: liste alfabetik ve 40 satırla sınırlı; başka
    // sekmeden gelen öğrenci ilk 40'ta değilse form onu "seçili" gösteremez
    // ve rehber öğrenciyi elle aramak zorunda kalırdı.
    fetch(`/api/guidance/students${initialStudentId ? `?studentId=${encodeURIComponent(initialStudentId)}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setStudents(
          (d.students ?? []).map((s: { id: string; name?: string; firstName?: string; lastName?: string; branchName?: string | null }) => ({
            id: s.id,
            name: s.name ?? `${s.firstName ?? ""} ${s.lastName ?? ""}`.trim(),
            branchName: s.branchName ?? null,
          }))
        )
      )
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
  }, [open, students.length, initialStudentId, showError]);

  // Aranabilir liste — 500 öğrencilik bir kurumda düz <select> kullanışsız
  // (gap-closing.tsx'te aynı gerekçeyle arama kutusuna geçilmişti).
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students.slice(0, 40);
    return students.filter((s) => s.name.toLocaleLowerCase("tr-TR").includes(q)).slice(0, 40);
  }, [students, query]);

  const selected = students.find((s) => s.id === studentId) ?? null;

  async function submit() {
    if (!studentId || !topic.trim()) {
      showError("Öğrenci ve görüşme konusu zorunludur.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/guidance/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          // datetime-local yerel saat verir; new Date(...) yerel olarak
          // yorumlar ve ISO'ya çevirirken UTC'ye doğru dönüştürür.
          scheduledAt: new Date(when).toISOString(),
          durationMin: duration,
          topic: topic.trim(),
          category,
          attendee,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Görüşme oluşturulamadı.");
      showSuccess("Görüşme planlandı, öğrenciye bildirim gitti.");
      setTopic("");
      setStudentId("");
      setQuery("");
      setOpen(false);
      onCreated();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Görüşme oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        <CalendarPlus className="h-4 w-4" /> Yeni Görüşme Planla
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-white p-4 dark:border-white/10 dark:bg-midnight-card/50">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso dark:text-cream">Yeni Görüşme</h3>
        <button onClick={() => setOpen(false)} aria-label="Kapat" className="text-espresso-muted hover:text-espresso dark:text-cream/40">
          <X className="h-4 w-4" />
        </button>
      </div>

      {selected ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 py-2.5 dark:bg-brand-600/10">
          <span className="min-w-0 truncate text-sm font-medium text-brand-800 dark:text-brand-200">
            {selected.name}
            {selected.branchName ? ` · ${selected.branchName}` : ""}
          </span>
          <button onClick={() => setStudentId("")} className="shrink-0 text-[11px] font-medium text-brand-700 underline dark:text-brand-300">
            Değiştir
          </button>
        </div>
      ) : (
        <div className="mb-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Öğrenci ara..."
              className="min-h-[44px] w-full rounded-xl border border-hairline bg-white pl-9 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>
          <div className="max-h-44 overflow-y-auto rounded-xl border border-hairline dark:border-white/10">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStudentId(s.id)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 border-b border-hairline px-3 text-left last:border-0 hover:bg-cream-card dark:border-white/5 dark:hover:bg-white/5"
                >
                  <span className="truncate text-sm text-espresso dark:text-cream">{s.name}</span>
                  {s.branchName && <span className="shrink-0 text-[11px] text-espresso-muted dark:text-cream/40">{s.branchName}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/45">Tarih ve saat</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border border-hairline bg-white px-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/45">Süre</span>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="min-h-[44px] w-full rounded-xl border border-hairline bg-white px-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {[15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} dakika
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Kiminle görüşülecek — bildirim de buna göre gider: veli
          görüşmesini öğrenciye haber vermenin anlamı yok. */}
      <div className="mb-2 flex gap-1.5">
        {(Object.keys(ATTENDEE_LABEL) as Meeting["attendee"][]).map((a) => (
          <button
            key={a}
            onClick={() => setAttendee(a)}
            className={cn(
              "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition",
              attendee === a
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/45"
            )}
          >
            {a === "STUDENT" ? <UserRound className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
            {ATTENDEE_LABEL[a]}
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-1.5">
        {(Object.keys(CATEGORY_LABEL) as Meeting["category"][]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={cn(
              "min-h-[40px] flex-1 rounded-xl text-xs font-semibold transition",
              category === c
                ? "bg-espresso text-cream dark:bg-brand-600"
                : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/45"
            )}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="Görüşme konusu (örn. sınav kaygısı, ders programı)"
        className="mb-3 min-h-[44px] w-full rounded-xl border border-hairline bg-white px-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      />

      <button
        onClick={submit}
        disabled={saving || !studentId || !topic.trim()}
        className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        {saving ? "Kaydediliyor..." : "Görüşmeyi Planla"}
      </button>
    </div>
  );
}

function MeetingRow({ meeting, onChanged }: { meeting: Meeting; onChanged: () => void }) {
  const { showError } = useToast();
  const [busy, setBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(meeting.outcomeNote ?? "");

  async function setStatus(status: Meeting["status"], outcomeNote?: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/guidance/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(outcomeNote !== undefined ? { outcomeNote } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Güncellenemedi.");
      setNoteOpen(false);
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  }

  const style = STATUS_STYLE[meeting.status];

  return (
    <div className="rounded-2xl border border-hairline bg-white px-3.5 py-3 dark:border-white/10 dark:bg-midnight-card/50">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 rounded-lg bg-cream-card px-2 py-1 text-[11px] font-bold tabular-nums text-espresso dark:bg-white/5 dark:text-cream">
          {timeOf(meeting.scheduledAt)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-espresso dark:text-cream">
            {meeting.studentName}
            {meeting.branchName ? <span className="font-normal text-espresso-muted dark:text-cream/45"> · {meeting.branchName}</span> : null}
          </p>
          <p className="truncate text-[11.5px] text-espresso-muted dark:text-cream/45">
            {meeting.topic} · {CATEGORY_LABEL[meeting.category]} · {ATTENDEE_LABEL[meeting.attendee] ?? "Öğrenci"} ·{" "}
            {meeting.durationMin} dk
          </p>
          {meeting.outcomeNote && (
            <p className="mt-1 rounded-lg bg-cream-card px-2 py-1 text-[11px] text-espresso-muted dark:bg-white/5 dark:text-cream/45">
              {meeting.outcomeNote}
            </p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", style.className)}>{style.label}</span>
      </div>

      {meeting.status === "PLANNED" && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button
            onClick={() => setNoteOpen((v) => !v)}
            disabled={busy}
            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-green-600 px-2.5 text-[11px] font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="h-3 w-3" /> Yapıldı
          </button>
          <button
            onClick={() => setStatus("NO_SHOW")}
            disabled={busy}
            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-amber-100 px-2.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-200 disabled:opacity-50 dark:bg-amber-500/15 dark:text-amber-300"
          >
            <UserX className="h-3 w-3" /> Gelmedi
          </button>
          <button
            onClick={() => setStatus("CANCELLED")}
            disabled={busy}
            className="flex min-h-[36px] items-center gap-1 rounded-lg bg-cream-card px-2.5 text-[11px] font-semibold text-espresso-muted transition hover:bg-cream-muted disabled:opacity-50 dark:bg-white/5 dark:text-cream/45"
          >
            <XCircle className="h-3 w-3" /> İptal
          </button>
        </div>
      )}

      {noteOpen && (
        <div className="mt-2.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Görüşme sonucu (kısa özet) — isteğe bağlı"
            className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-[13px] text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <button
            onClick={() => setStatus("DONE", note.trim())}
            disabled={busy}
            className="mt-1.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-espresso text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Yapıldı olarak kapat
          </button>
        </div>
      )}
    </div>
  );
}

export function GuidanceMeetingsTab({ initialStudentId }: { initialStudentId?: string | null }) {
  const { showError } = useToast();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/guidance/meetings")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMeetings(d.meetings ?? []))
      .catch(() => showError("Görüşme takvimi yüklenemedi."));
  }, [showError]);

  useEffect(load, [load]);

  // Güne göre grupla — takvim gibi okunsun, düz liste gibi değil.
  const grouped = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const m of meetings ?? []) {
      const key = dayKey(m.scheduledAt);
      const list = map.get(key) ?? [];
      list.push(m);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [meetings]);

  const todayCount = (meetings ?? []).filter((m) => isToday(m.scheduledAt) && m.status === "PLANNED").length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-espresso dark:text-cream">Görüşme Takvimi</h2>
        <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/45">
          {todayCount > 0 ? `Bugün ${todayCount} görüşmeniz var.` : "Bugün planlanmış görüşmeniz yok."} Son 7 gün ve önümüzdeki 30 gün gösterilir.
        </p>
      </div>

      <NewMeetingForm onCreated={load} initialStudentId={initialStudentId} />

      {meetings === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-8 text-center dark:border-white/10 dark:bg-midnight-card/50">
          <CalendarClock className="mx-auto mb-2 h-7 w-7 text-espresso-muted dark:text-cream/30" />
          <p className="text-sm font-semibold text-espresso dark:text-cream">Henüz görüşme yok</p>
          <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/45">
            Yukarıdan bir öğrenci seçip ilk görüşmenizi planlayın.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {grouped.map(([day, list]) => (
              <motion.section key={day} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  <CalendarClock className="h-3.5 w-3.5" /> {day}
                  <span className="rounded-full bg-cream-card px-1.5 text-[10px] tabular-nums dark:bg-white/10">{list.length}</span>
                </h3>
                <div className="space-y-2">
                  {list.map((m) => (
                    <MeetingRow key={m.id} meeting={m} onChanged={load} />
                  ))}
                </div>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
