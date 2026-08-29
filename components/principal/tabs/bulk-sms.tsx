"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  MessageSquareText,
  Coins,
  Plus,
  Trash2,
  Search,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type Template = { id: string; title: string; content: string };
type ParentInfo = { id: string; name: string; mobilePhone: string; smsConsent: boolean };
type StudentOption = { id: string; firstName: string; lastName: string; branchName: string; parents: ParentInfo[] };
type BatchProgress = { total: number; pending: number; sent: number; failed: number };

function hasConsentingParent(student: StudentOption): boolean {
  return student.parents.some((p) => p.smsConsent);
}

// Şablon ekleme formu — schedule-matrix.tsx'teki SlotManagerModal'la AYNI
// "ekle, listede hemen görün" deseni, ama modal yerine kart içinde satır içi
// (şablonlar burada ana akışın bir parçası, ayrı bir yönetim ekranı gerektirecek
// kadar karmaşık değil).
function TemplateManager({
  templates,
  onSelect,
  onChanged,
}: {
  templates: Template[];
  onSelect: (content: string) => void;
  onChanged: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function saveTemplate() {
    if (!newTitle.trim() || !newContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sms-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Şablon kaydedilemedi.");
      showSuccess("Şablon kaydedildi.");
      setNewTitle("");
      setNewContent("");
      setAdding(false);
      onChanged();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Şablon kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/sms-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onChanged();
    } catch {
      showError("Şablon silinemedi.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {templates.map((template) => (
          <div
            key={template.id}
            className="group relative flex items-center gap-1.5 rounded-full bg-cream-card pl-3.5 pr-2 py-2 text-xs font-medium text-espresso transition hover:bg-brand-50 dark:bg-white/5 dark:text-cream dark:hover:bg-brand-600/15"
          >
            <button onClick={() => onSelect(template.content)} className="text-left">
              {template.title}
            </button>
            <button
              onClick={() => deleteTemplate(template.id)}
              disabled={deletingId === template.id}
              className="flex h-5 w-5 items-center justify-center rounded-full text-espresso-muted opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100 disabled:opacity-40 dark:text-cream/40 dark:hover:bg-rose-500/20"
            >
              {deletingId === template.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        ))}
        {templates.length === 0 && !adding && (
          <p className="py-2 text-xs text-espresso-muted dark:text-cream/40">Henüz kayıtlı şablon yok.</p>
        )}
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 rounded-full border border-dashed border-hairline px-3 py-2 text-xs font-medium text-espresso-muted transition hover:border-brand-500/50 hover:text-brand-600 dark:border-white/10 dark:text-cream/40"
        >
          <Plus className="h-3 w-3" /> Şablon Ekle
        </button>
      </div>

      {adding && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2 rounded-xl bg-cream-card p-3 dark:bg-white/5"
        >
          <input
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            placeholder="Başlık (örn. Ödev Yapılmadı)"
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <textarea
            value={newContent}
            onChange={(event) => setNewContent(event.target.value)}
            rows={2}
            placeholder="Mesaj metni — {veli_adi} ve {ogrenci_adi} otomatik doldurulur."
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
          <button
            onClick={saveTemplate}
            disabled={saving || !newTitle.trim() || !newContent.trim()}
            className="flex min-h-[36px] items-center gap-1.5 rounded-lg bg-espresso px-3 text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Kaydet"}
          </button>
        </motion.div>
      )}
    </div>
  );
}

export function BulkSmsTab() {
  const { showError, showSuccess } = useToast();
  const [credits, setCredits] = useState<number | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);

  function loadCredits() {
    fetch("/api/admin/sms/credits")
      .then((res) => res.json())
      .then((data) => setCredits(data.smsCredits ?? 0))
      .catch(() => showError("Kalan kontür bilgisi yüklenemedi."));
  }

  function loadTemplates() {
    fetch("/api/admin/sms-templates")
      .then((res) => res.json())
      .then((data) => setTemplates(data.templates ?? []))
      .catch(() => showError("Şablonlar yüklenemedi."));
  }

  useEffect(() => {
    loadCredits();
    loadTemplates();
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => res.json())
      .then((data) => setStudents(data.students ?? []))
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return students;
    return students.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q));
  }, [students, query]);

  function toggleStudent(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredStudents.map((s) => s.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function pollBatch(batchId: string) {
    for (let attempt = 0; attempt < 15; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const res = await fetch(`/api/notifications/${batchId}`);
        const data = await res.json();
        if (!res.ok) return;
        setProgress({ total: data.total, pending: data.pending, sent: data.sent, failed: data.failed });
        if (data.pending === 0) return;
      } catch {
        return;
      }
    }
  }

  async function handleSend() {
    if (selectedIds.size === 0 || !message.trim()) return;
    setSending(true);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: Array.from(selectedIds), message: message.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Gönderim başarısız.");
      setCredits(data.remainingCredits);
      showSuccess(`${data.recipientCount} alıcıya gönderim kuyruğa alındı.`);
      setProgress({ total: data.recipientCount, pending: data.recipientCount, sent: 0, failed: 0 });
      pollBatch(data.batchId);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Gönderim başarısız.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <motion.div
          whileHover={{ scale: 1.02, y: -3 }}
          className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
        >
          <p className="flex items-center justify-center gap-1.5 text-2xl font-bold text-espresso dark:text-cream">
            <Coins className="h-5 w-5 text-brand-600" /> {credits ?? "—"}
          </p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Kalan SMS Kontürü</p>
        </motion.div>
        <motion.div
          whileHover={{ scale: 1.02, y: -3 }}
          className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
        >
          <p className="flex items-center justify-center gap-1.5 text-2xl font-bold text-espresso dark:text-cream">
            <Users className="h-5 w-5 text-brand-600" /> {selectedIds.size}
          </p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">Seçili Öğrenci</p>
        </motion.div>
        {progress && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-hairline bg-white/70 p-4 text-center shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50"
          >
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-espresso dark:text-cream">
              {progress.pending > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
              ) : progress.failed > 0 ? (
                <XCircle className="h-4 w-4 text-rose-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              )}
              {progress.sent}/{progress.total} gönderildi
            </p>
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">{progress.failed > 0 ? `${progress.failed} başarısız` : "Gönderim durumu"}</p>
          </motion.div>
        )}
      </div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <MessageSquareText className="h-4 w-4 text-brand-600" /> Mesaj Şablonları
        </h2>
        <TemplateManager templates={templates} onSelect={setMessage} onChanged={loadTemplates} />

        <p className="mb-1.5 mt-4 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Gönderilecek Mesaj</p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="Sayın {veli_adi}, öğrenciniz {ogrenci_adi} ..."
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <p className="mt-1 text-[10px] text-espresso-muted dark:text-cream/40">
          {"{veli_adi}"} ve {"{ogrenci_adi}"} her alıcı için otomatik doldurulur.
        </p>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
            <Users className="h-4 w-4 text-brand-600" /> Alıcılar
          </h2>
          <div className="flex gap-1.5 text-[11px] font-medium">
            <button onClick={selectAllFiltered} className="rounded-full border border-hairline px-2.5 py-1 text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5">
              Tümünü Seç
            </button>
            <button onClick={clearSelection} className="rounded-full border border-hairline px-2.5 py-1 text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5">
              Seçimi Temizle
            </button>
          </div>
        </div>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Öğrenci ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl bg-cream-card p-1.5 dark:bg-white/5">
          {filteredStudents.map((student) => {
            const consenting = hasConsentingParent(student);
            const isSelected = selectedIds.has(student.id);
            return (
              <label
                key={student.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs transition hover:bg-white dark:hover:bg-white/10"
              >
                <input type="checkbox" checked={isSelected} onChange={() => toggleStudent(student.id)} className="h-4 w-4 shrink-0 accent-brand-600" />
                <span className="min-w-0 flex-1 truncate text-espresso dark:text-cream">
                  {student.firstName} {student.lastName} <span className="text-espresso-muted dark:text-cream/40">· {student.branchName}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    consenting ? "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                  )}
                >
                  {consenting ? "SMS onaylı veli" : "SMS onayı yok"}
                </span>
              </label>
            );
          })}
          {filteredStudents.length === 0 && <p className="px-2 py-2 text-xs text-espresso-muted dark:text-cream/40">Öğrenci bulunamadı.</p>}
        </div>

        <button
          onClick={handleSend}
          disabled={selectedIds.size === 0 || !message.trim() || sending}
          className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? "Gönderiliyor..." : `${selectedIds.size} Öğrenciye SMS Gönder`}
        </button>
      </motion.div>
    </div>
  );
}
