"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Send, CheckCircle2, ListChecks, Link2, UploadCloud, Plus, X, Target, Loader2 } from "lucide-react";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

const TEMPLATES = ["Konudan 20 Soru", "Deneme Tekrar Testi", "Eksik Kapatma Seti", "Serbest Ödev", "Diğer"];

type HomeworkEntry = { id: string; title: string; branchIds: string[]; dueAt: string | null; createdAt: string };

export function QuickHomeworkAssignerTab() {
  const { staffRecord, assignedBranches, subject } = useTeacherScope();
  const { showError } = useToast();

  const [branchIds, setBranchIds] = useState<string[]>(assignedBranches[0] ? [assignedBranches[0].id] : []);
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [description, setDescription] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [targetQuestionCount, setTargetQuestionCount] = useState<number | "">("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<HomeworkEntry[]>([]);

  const title = template === "Diğer" ? customTitle : template;

  async function loadMine() {
    try {
      const res = await fetch(`/api/homework?teacherId=${encodeURIComponent(staffRecord.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setMine(data.homeworks ?? []);
    } catch {
      // sessiz — liste boş kalır, kart altında zaten "yok" mesajı gösteriliyor
    }
  }

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffRecord.id]);

  function toggleBranch(id: string) {
    setBranchIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function addChecklistItem() {
    if (!checklistDraft.trim()) return;
    setChecklist((prev) => [...prev, checklistDraft]);
    setChecklistDraft("");
  }

  async function handleSend() {
    if (branchIds.length === 0 || !title.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: staffRecord.id,
          branchIds,
          title,
          description,
          linkUrl: linkUrl || undefined,
          fileNames,
          checklist,
          targetQuestionCount: targetQuestionCount === "" ? undefined : targetQuestionCount,
          dueAt: dueAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Ödev gönderilemedi.");

      setSent(true);
      setDescription("");
      setLinkUrl("");
      setFileNames([]);
      setChecklist([]);
      setCustomTitle("");
      setTargetQuestionCount("");
      loadMine();
      setTimeout(() => setSent(false), 2000);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Ödev gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Zap className="h-4 w-4 text-brand-600" /> Gelişmiş Ödev Atama Modülü
        </h2>
        <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">{subject}</p>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Sınıflar (çoklu seçim)</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {assignedBranches.map((b) => (
            <label
              key={b.id}
              className={cn(
                "flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                branchIds.includes(b.id) ? "border-brand-600 bg-brand-600 text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
              )}
            >
              <input type="checkbox" checked={branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} className="hidden" />
              {b.name}
            </label>
          ))}
        </div>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Şablon</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TEMPLATES.map((item) => (
            <button
              key={item}
              onClick={() => setTemplate(item)}
              className={cn(
                "min-h-[40px] rounded-full border px-3 py-1.5 text-xs font-medium transition",
                template === item ? "border-brand-600 bg-brand-600 text-white" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/40"
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {template === "Diğer" && (
            <motion.input
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="Özel ödev başlığı yazın"
              className="mb-3 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          )}
        </AnimatePresence>

        <p className="mb-1.5 text-[11px] font-medium text-espresso-muted dark:text-cream/40">Teslim Tarihi & Saati</p>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="mb-4 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />

        <div className="mb-4 space-y-3 rounded-2xl border border-hairline p-3 dark:border-white/10">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-espresso dark:text-cream">Ödev İçeriği</p>

          <div className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 dark:border-white/10">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="YouTube / Web bağlantısı"
              className="w-full bg-transparent text-xs text-espresso outline-none dark:text-cream"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-2 text-xs text-espresso-muted transition hover:border-brand-600/40 dark:border-white/10 dark:text-cream/40">
            <UploadCloud className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            {fileNames.length > 0 ? fileNames.join(", ") : "PDF yükle"}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setFileNames((prev) => [...prev, file.name]);
              }}
            />
          </label>

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Detaylı metin açıklaması"
            rows={2}
            className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">
              Adım Adım Yapılacaklar
            </p>
            <div className="mb-1.5 space-y-1">
              {checklist.map((item, index) => (
                <div key={index} className="flex items-center gap-1.5 rounded-lg bg-cream-card px-2 py-1 text-xs text-espresso dark:bg-white/5 dark:text-cream">
                  <ListChecks className="h-3 w-3 shrink-0 text-brand-600" /> {item}
                  <button onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== index))} className="ml-auto text-espresso-muted hover:text-rose-600 dark:text-cream/40">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={checklistDraft}
                onChange={(event) => setChecklistDraft(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addChecklistItem())}
                placeholder="Adım ekle"
                className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
              <button onClick={addChecklistItem} className="rounded-lg bg-espresso px-2.5 text-cream dark:bg-brand-600">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 dark:border-white/10">
            <Target className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <input
              type="number"
              value={targetQuestionCount}
              onChange={(event) => setTargetQuestionCount(event.target.value === "" ? "" : Number(event.target.value))}
              placeholder="Hedef soru sayısı"
              className="w-full bg-transparent text-xs text-espresso outline-none dark:text-cream"
            />
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSend}
          disabled={branchIds.length === 0 || !title.trim() || sending}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-3.5 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : sent ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {sending ? "Gönderiliyor..." : sent ? "Gönderildi!" : `${branchIds.length} sınıfa gönder`}
        </motion.button>
      </motion.div>

      <motion.div
        whileHover={{ scale: 1.005, y: -2 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <ListChecks className="h-4 w-4 text-brand-600" /> Atanan Ödevler
        </h2>
        <div className="space-y-2">
          {mine.map((item) => {
            const branchNames = item.branchIds.map((id) => assignedBranches.find((b) => b.id === id)?.name ?? id).join(", ");
            return (
              <div key={item.id} className="rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
                <p className="text-sm font-medium text-espresso dark:text-cream">
                  {item.title} <span className="text-espresso-muted dark:text-cream/40">· {branchNames}</span>
                </p>
                <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                  {item.dueAt ? `Teslim: ${item.dueAt.replace("T", " ").slice(0, 16)}` : "Teslim tarihi belirtilmedi"} · {new Date(item.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
            );
          })}
          {mine.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz ödev atanmadı.</p>}
        </div>
      </motion.div>
    </div>
  );
}
