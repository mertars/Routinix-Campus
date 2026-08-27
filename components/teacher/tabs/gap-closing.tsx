"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Puzzle, Send, Link2, UploadCloud, Loader2 } from "lucide-react";
import { CURRICULUM_TREE } from "@/lib/mock-data";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";

type RosterStudent = { id: string; firstName: string; lastName: string; branchName: string };
type TaskEntry = { id: string; topic: string; taskDescription: string; assignedAt: string };

export function GapClosingTab() {
  const { assignedBranches, subject } = useTeacherScope();
  const { showError } = useToast();
  const subtopics = (CURRICULUM_TREE[subject] ?? []).flatMap((topic) => topic.subtopics);

  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [studentId, setStudentId] = useState("");
  const [topic, setTopic] = useState(subtopics[0]?.name ?? "");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);

  useEffect(() => {
    if (assignedBranches.length === 0) return;
    fetch(`/api/students?branchIds=${assignedBranches.map((b) => b.id).join(",")}`)
      .then((res) => res.json())
      .then((data) => {
        const roster: RosterStudent[] = data.students ?? [];
        setStudents(roster);
        setStudentId((current) => current || roster[0]?.id || "");
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedBranches.map((b) => b.id).join(",")]);

  const student = students.find((s) => s.id === studentId);

  async function loadTasks() {
    if (!studentId) return;
    try {
      const res = await fetch(`/api/remediation-tasks?studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch {
      // sessiz — kart altında zaten "yok" mesajı gösteriliyor
    }
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function handleSend() {
    if (!student || !description.trim()) return;

    setSending(true);
    try {
      const fullDescription = linkUrl.trim() ? `${description.trim()} — ${linkUrl.trim()}` : description.trim();
      const res = await fetch("/api/remediation-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: student.id, topic, taskDescription: fullDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Görev gönderilemedi.");

      setDescription("");
      setLinkUrl("");
      setFileName(null);
      loadTasks();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Görev gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Puzzle className="h-4 w-4 text-brand-600" /> Eksik Kapatma — Kazanım Görevi
        </h2>

        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <select
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} — {s.branchName}
              </option>
            ))}
          </select>
          <select
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            className="rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            {subtopics.map((sub) => (
              <option key={sub.id} value={sub.name}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Detaylı açıklama (örn. Türev kuralları tekrarı — 15 soru)"
          rows={2}
          className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />

        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 dark:border-white/10">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="Link ekle"
              className="w-full bg-transparent text-xs text-espresso outline-none dark:text-cream"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-2 text-xs text-espresso-muted transition hover:border-brand-600/40 dark:border-white/10 dark:text-cream/40">
            <UploadCloud className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            {fileName ?? "PDF yükle"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setFileName(file.name);
              }}
            />
          </label>
        </div>

        <button
          onClick={handleSend}
          disabled={!student || !description.trim() || sending}
          className="flex items-center gap-2 rounded-lg bg-espresso px-4 py-2 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Kazanım Görevi Gönder
        </button>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 text-sm font-semibold text-espresso dark:text-cream">
          {student ? `${student.firstName} ${student.lastName} — Atanan Görevler` : "Atanan Görevler"}
        </h2>
        <div className="space-y-2">
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5"
              >
                <p className="text-sm font-medium text-espresso dark:text-cream">{task.topic}</p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">{task.taskDescription}</p>
                <p className="text-[10px] text-espresso-muted/70 dark:text-cream/30">{new Date(task.assignedAt).toLocaleString("tr-TR")}</p>
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz kazanım görevi atanmadı.</p>}
        </div>
      </motion.div>
    </div>
  );
}
