"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Loader2, Megaphone } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { useTeacherScope } from "@/lib/teacher-scope";
import { useInstitutionName } from "@/lib/institution-scope";
import { TemplateBar } from "@/components/ui/template-bar";
import { fillPlaceholders } from "@/lib/templates/catalog";
import { cn } from "@/lib/utils";

type AnnouncementCategory = "GENERAL" | "EXAM" | "HOLIDAY" | "EVENT" | "EMERGENCY";
type ScopeType = "ALL_SCHOOL" | "GRADE" | "BRANCH";
type AnnouncementEntry = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  authorName: string;
  authorRole: "ADMIN" | "TEACHER";
  scopeType: ScopeType;
  scopeValue: string | null;
  createdAt: string;
};

const CATEGORY_OPTIONS: { id: AnnouncementCategory; label: string }[] = [
  { id: "GENERAL", label: "Genel" },
  { id: "EXAM", label: "Sınav Haftası" },
  { id: "HOLIDAY", label: "İdari Tatil" },
  { id: "EVENT", label: "Etkinlik" },
  { id: "EMERGENCY", label: "Acil Bildirim" },
];

const CATEGORY_STYLES: Record<AnnouncementCategory, string> = {
  EXAM: "border-l-rose-500 bg-rose-50/60 dark:bg-rose-500/10",
  HOLIDAY: "border-l-caramel bg-cream-card dark:bg-white/5",
  GENERAL: "border-l-brand-600 bg-cream-card dark:bg-white/5",
  EVENT: "border-l-green-500 bg-green-50/60 dark:bg-green-500/10",
  EMERGENCY: "border-l-rose-600 bg-rose-100/80 dark:bg-rose-500/20",
};

const CATEGORY_BADGE: Record<AnnouncementCategory, string> = {
  EXAM: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  HOLIDAY: "bg-espresso/10 text-espresso dark:bg-caramel/30 dark:text-cream",
  GENERAL: "bg-brand-100 text-brand-700 dark:bg-brand-600/20 dark:text-brand-300",
  EVENT: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300",
  EMERGENCY: "bg-rose-200 text-rose-800 dark:bg-rose-500/30 dark:text-rose-200",
};

// Kullanıcı talebi (Part 3, "bütün arayüzlere bildirimleri göreceği yer
// koy"): Admin/Öğrenci/Veli'de zaten bir Duyurular ekranı vardı (bkz.
// components/principal/tabs/announcements.tsx, components/student/tabs/
// announcements.tsx), Öğretmen'in 13 sekmesinin HİÇBİRİ bu değildi — API
// zaten öğretmenin duyuru göndermesine izin veriyordu (POST'ta requireRole
// principal+teacher) ama gönderdikten sonra görebileceği ya da başkalarının
// gönderdiklerini görebileceği bir ekran yoktu. Admin'in "Kampüs Panosu"
// kartıyla AYNI compose+liste deseni — TransparentReportGenerator/
// BulkReportSender (admin'e özgü toplu WhatsApp/PDF karne araçları)
// BİLİNÇLİ olarak buraya taşınmadı, bu ekranın konusu değil.
export function TeacherAnnouncementsTab() {
  const { showError, showSuccess } = useToast();
  const { assignedBranches } = useTeacherScope();
  const institutionName = useInstitutionName();
  const [announcements, setAnnouncements] = useState<AnnouncementEntry[] | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("GENERAL");
  const [scopeType, setScopeType] = useState<ScopeType>("ALL_SCHOOL");
  const [scopeBranchId, setScopeBranchId] = useState(assignedBranches[0]?.id ?? "");
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setScopeBranchId((current) => current || assignedBranches[0]?.id || "");
  }, [assignedBranches]);

  async function loadAnnouncements() {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setAnnouncements(data.announcements ?? []);
    } catch {
      showError("Duyurular yüklenemedi.");
    }
  }

  useEffect(() => {
    loadAnnouncements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAdd() {
    if (!title.trim()) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category,
          scopeType,
          scopeValue: scopeType === "BRANCH" ? scopeBranchId : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Duyuru yayınlanamadı.");
      showSuccess("Duyuru yayınlandı.");
      setTitle("");
      setContent("");
      setCategory("GENERAL");
      setScopeType("ALL_SCHOOL");
      setIsAdding(false);
      loadAnnouncements();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Duyuru yayınlanamadı.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.005, y: -2 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
          <Megaphone className="h-4 w-4 text-brand-600" /> Kampüs Panosu
        </h2>
        <button
          onClick={() => setIsAdding((value) => !value)}
          className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <Plus className="h-3.5 w-3.5" /> Yeni Duyuru
        </button>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden rounded-xl border border-hairline bg-cream-card p-3 dark:border-white/10 dark:bg-white/5"
          >
            <TemplateBar
              module="ANNOUNCEMENT"
              className="mb-2"
              onApply={(p) => {
                const values = { kurum: institutionName };
                if (typeof p.title === "string") setTitle(fillPlaceholders(p.title, values));
                if (typeof p.content === "string") setContent(fillPlaceholders(p.content, values));
                if (typeof p.category === "string") setCategory(p.category as AnnouncementCategory);
              }}
              getCurrent={() => (title.trim() || content.trim() ? { title: title.trim(), content: content.trim(), category } : null)}
            />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Duyuru başlığı"
              className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Duyuru içeriği"
              rows={2}
              className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
            <div className="mb-2 flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setCategory(option.id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                    category === option.id ? CATEGORY_BADGE[option.id] : "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Hedef Kitle</p>
            <div className="mb-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => setScopeType("ALL_SCHOOL")}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                  scopeType === "ALL_SCHOOL" ? "bg-espresso text-cream dark:bg-brand-600" : "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                )}
              >
                Tüm Okul
              </button>
              {assignedBranches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setScopeType("BRANCH")}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                    scopeType === "BRANCH" ? "bg-espresso text-cream dark:bg-brand-600" : "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                  )}
                >
                  Kendi Şubem
                </button>
              )}
            </div>
            {scopeType === "BRANCH" && (
              <select
                value={scopeBranchId}
                onChange={(event) => setScopeBranchId(event.target.value)}
                className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              >
                {assignedBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleAdd}
              disabled={publishing || !title.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              {publishing && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Yayınla
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {announcements === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        ) : (
          <>
            {announcements.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("rounded-xl border-l-4 p-3", CATEGORY_STYLES[item.category])}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-espresso dark:text-cream">{item.title}</p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium", CATEGORY_BADGE[item.category])}>
                    {CATEGORY_OPTIONS.find((option) => option.id === item.category)?.label}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-espresso-muted dark:text-cream/40">{item.content}</p>
                <p className="mt-1 text-[10px] text-espresso-muted/60 dark:text-cream/30">
                  {item.authorName} · {new Date(item.createdAt).toLocaleString("tr-TR")}
                </p>
              </motion.div>
            ))}
            {announcements.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz duyuru yayınlanmadı.</p>}
          </>
        )}
      </div>
    </motion.div>
  );
}
