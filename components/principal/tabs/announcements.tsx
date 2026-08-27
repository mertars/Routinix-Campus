"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Share2, FileDown, Loader2, Send, Clock, CheckCircle2 } from "lucide-react";
import { INITIAL_BRANCHES } from "@/lib/mock-data";
import { useToast } from "@/lib/toast-context";
import { fetchDashboard } from "@/lib/client/fetch-dashboard";
import { cn } from "@/lib/utils";

type AnnouncementCategory = "GENERAL" | "EXAM" | "HOLIDAY" | "EVENT" | "EMERGENCY";
type ScopeType = "ALL_SCHOOL" | "GRADE" | "BRANCH";
type AnnouncementEntry = {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
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

const SCOPE_OPTIONS: { id: ScopeType; label: string }[] = [
  { id: "ALL_SCHOOL", label: "Tüm Okul" },
  { id: "GRADE", label: "Kademe" },
  { id: "BRANCH", label: "Şube" },
];

const GRADE_OPTIONS = [5, 6, 7, 8, 9, 10, 11, 12];

function BulkReportSender() {
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [sentCount, setSentCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchDashboard<{ totalStudents?: number }>("ALL")
      .then((data) => setTotal(data.totalStudents ?? 0))
      .catch(() => {
        // sessiz — sayaç 0 kalır
      });
  }, []);

  function handleBulkSend() {
    if (total === 0) return;
    setStatus("sending");
    setSentCount(0);
    const step = Math.ceil(total / 12);
    const interval = setInterval(() => {
      setSentCount((prev) => {
        const next = Math.min(total, prev + step);
        if (next >= total) {
          clearInterval(interval);
          setStatus("done");
        }
        return next;
      });
    }, 120);
  }

  return (
    <button
      onClick={handleBulkSend}
      disabled={status === "sending" || total === 0}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:opacity-70"
    >
      {status === "sending" ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {sentCount}/{total} veliye gönderildi...
        </>
      ) : status === "done" ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" /> {total} veliye gönderildi
        </>
      ) : (
        <>
          <Send className="h-3.5 w-3.5" /> Tüm Velilere WhatsApp/PDF Karne Gönder
        </>
      )}
    </button>
  );
}

type ReportStudent = { id: string; firstName: string; lastName: string; branchName: string };
type ReportDetail = { targetNet: number | null; actualNet: number | null; weeklyStudyHours: number | null; attendanceRate: number };

function TransparentReportGenerator() {
  const { showError } = useToast();
  const [students, setStudents] = useState<ReportStudent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    fetch("/api/admin/users/directory?role=STUDENT")
      .then((res) => res.json())
      .then((data) => {
        const rows: ReportStudent[] = data.students ?? [];
        setStudents(rows);
        setSelectedId((current) => current || rows[0]?.id || "");
      })
      .catch(() => showError("Öğrenci listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    fetch(`/api/students/${encodeURIComponent(selectedId)}`)
      .then((res) => res.json())
      .then((data) => setDetail({ targetNet: data.targetNet, actualNet: data.actualNet, weeklyStudyHours: data.weeklyStudyHours, attendanceRate: data.attendanceRate }))
      .catch(() => showError("Öğrenci verisi yüklenemedi."));
    setPdfState("idle");
  }, [selectedId, showError]);

  const student = students.find((row) => row.id === selectedId);

  const message = student && detail
    ? encodeURIComponent(
        `Merhaba, ${student.firstName} ${student.lastName} için haftalık şeffaf karne: Hedef Net ${detail.targetNet ?? "—"}, Gerçekleşen Net ${detail.actualNet ?? "—"}, Çalışma Süresi ${detail.weeklyStudyHours ?? "—"} sa, Katılım %${detail.attendanceRate}. — Routinix Kampüs`
      )
    : "";
  const whatsappUrl = `https://wa.me/?text=${message}`;

  async function handlePdf() {
    if (!selectedId || !student) return;
    setPdfState("loading");
    try {
      const res = await fetch(`/api/report-cards/${selectedId}?donem=${encodeURIComponent("2025-2026 Güncel Dönem")}`);
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("application/pdf")) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${student.firstName}-${student.lastName}-seffaf-karne.pdf`.replace(/\s+/g, "-");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setPdfState("done");
    } catch {
      showError("Karne oluşturulamadı.");
      setPdfState("idle");
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Velilere Özel Şeffaf Karne</h2>

      <select
        value={selectedId}
        onChange={(event) => {
          setSelectedId(event.target.value);
          setPdfState("idle");
        }}
        className="mb-4 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
      >
        {students.map((row) => (
          <option key={row.id} value={row.id}>
            {row.firstName} {row.lastName} — {row.branchName}
          </option>
        ))}
      </select>

      {student && detail && (
        <motion.div
          key={student.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl bg-cream-card p-4 dark:bg-white/5"
        >
          <p className="text-sm font-medium text-espresso dark:text-cream">{student.firstName} {student.lastName}</p>
          <p className="text-xs text-espresso-muted dark:text-cream/40">{student.branchName}</p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/70 py-2 dark:bg-white/5">
              <p className="flex items-center justify-center gap-1 text-espresso-muted dark:text-cream/40">
                <Clock className="h-3 w-3" /> Süre
              </p>
              <p className="mt-0.5 font-semibold text-espresso dark:text-cream">{detail.weeklyStudyHours ?? "—"} sa</p>
            </div>
            <div className="rounded-lg bg-white/70 py-2 dark:bg-white/5">
              <p className="flex items-center justify-center gap-1 text-espresso-muted dark:text-cream/40">
                <CheckCircle2 className="h-3 w-3" /> Katılım
              </p>
              <p className="mt-0.5 font-semibold text-espresso dark:text-cream">%{detail.attendanceRate}</p>
            </div>
            <div className="rounded-lg bg-white/70 py-2 dark:bg-white/5">
              <p className="text-espresso-muted dark:text-cream/40">Net Ort.</p>
              <p className="mt-0.5 font-semibold text-brand-600">{detail.actualNet ?? "—"}</p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-xs font-medium text-white transition hover:bg-green-700"
        >
          <Share2 className="h-3.5 w-3.5" /> WhatsApp&apos;ta Paylaş
        </a>
        <button
          onClick={handlePdf}
          disabled={pdfState === "loading"}
          className="flex items-center gap-2 rounded-lg border border-hairline px-4 py-2 text-xs font-medium text-espresso transition hover:bg-cream-card disabled:opacity-60 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          {pdfState === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileDown className="h-3.5 w-3.5" />
          )}
          {pdfState === "done" ? "PDF Hazır ✓" : pdfState === "loading" ? "Hazırlanıyor..." : "PDF Oluştur"}
        </button>
      </div>

      <div className="mt-4 border-t border-hairline pt-4 dark:border-white/10">
        <BulkReportSender />
      </div>
    </motion.div>
  );
}

export function AnnouncementsTab() {
  const { showError, showSuccess } = useToast();
  const [announcements, setAnnouncements] = useState<AnnouncementEntry[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("GENERAL");
  const [scopeType, setScopeType] = useState<ScopeType>("ALL_SCHOOL");
  const [scopeGrade, setScopeGrade] = useState(String(GRADE_OPTIONS[0]));
  const [scopeBranchId, setScopeBranchId] = useState(INITIAL_BRANCHES[0]?.id ?? "");
  const [publishing, setPublishing] = useState(false);

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
          scopeValue: scopeType === "GRADE" ? scopeGrade : scopeType === "BRANCH" ? scopeBranchId : undefined,
          authorName: "Mert Yönetici",
          authorRole: "ADMIN",
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
    <div className="grid gap-4 lg:grid-cols-2">
      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-espresso dark:text-cream">Kampüs Panosu</h2>
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
                      category === option.id
                        ? CATEGORY_BADGE[option.id]
                        : "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Hedef Kitle</p>
              <div className="mb-2 flex gap-1.5">
                {SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setScopeType(option.id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                      scopeType === option.id ? "bg-espresso text-cream dark:bg-brand-600" : "bg-white text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {scopeType === "GRADE" && (
                <select
                  value={scopeGrade}
                  onChange={(event) => setScopeGrade(event.target.value)}
                  className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  {GRADE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}. Sınıf</option>
                  ))}
                </select>
              )}
              {scopeType === "BRANCH" && (
                <select
                  value={scopeBranchId}
                  onChange={(event) => setScopeBranchId(event.target.value)}
                  className="mb-2 w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  {INITIAL_BRANCHES.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
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
                {SCOPE_OPTIONS.find((s) => s.id === item.scopeType)?.label}
                {item.scopeType === "GRADE" && ` · ${item.scopeValue}. Sınıf`}
                {item.scopeType === "BRANCH" && ` · ${INITIAL_BRANCHES.find((b) => b.id === item.scopeValue)?.name ?? item.scopeValue}`}
                {" · "}
                {new Date(item.createdAt).toLocaleString("tr-TR")}
              </p>
            </motion.div>
          ))}
          {announcements.length === 0 && <p className="text-xs text-espresso-muted dark:text-cream/40">Henüz duyuru yayınlanmadı.</p>}
        </div>
      </motion.div>

      <TransparentReportGenerator />
    </div>
  );
}
