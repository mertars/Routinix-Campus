"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Users, GraduationCap, Target, CalendarCheck2, LogOut, Wallet, ChevronRight, Megaphone, BookOpen, TrendingUp, LayoutDashboard } from "lucide-react";
import { useLogout } from "@/lib/role-context";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { XRAY_MIN_GRADE } from "@/lib/mock-data";
import { XrayParentSummaryCard } from "@/components/parent/xray-summary-card";
import { ParentAttendanceTab } from "@/components/parent/attendance-tab";
import { ParentHomeworkTab } from "@/components/parent/homework-tab";
import { ParentAnnouncementsTab } from "@/components/parent/announcements-tab";
import { ParentExamsTab } from "@/components/parent/exams-tab";
import { cn } from "@/lib/utils";

// Veli panelinin sekmeleri.
//
// Panel eskiden tek bir performans kartıydı: güncel net, hedef net,
// devam ORANI. Oysa veliye açık uçların çoğu (duyuru, deneme detayı,
// karne) panelde hiç okunmuyordu — ölçüldü: 22 uçtan 4'ü.
const TABS = [
  { id: "overview", label: "Genel", icon: LayoutDashboard },
  { id: "attendance", label: "Devam", icon: CalendarCheck2 },
  { id: "exams", label: "Denemeler", icon: TrendingUp },
  { id: "homework", label: "Ödevler", icon: BookOpen },
  { id: "announcements", label: "Duyurular", icon: Megaphone },
] as const;
type TabId = (typeof TABS)[number]["id"];

type StudentDetail = {
  id: string;
  firstName: string;
  lastName: string;
  branchName: string;
  grade: number;
  targetNet: number | null;
  actualNet: number | null;
  attendanceRate: number;
};

export default function ParentPage() {
  const logout = useLogout();
  const router = useRouter();
  const [parentName, setParentName] = useState("");
  const [students, setStudents] = useState<StudentDetail[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Oturum açmış velinin kendisi + bağlı öğrencilerinin özet performansı TEK
  // istekte gelir (bkz. /api/parent/me) — session cookie'ye göre sınırlıdır,
  // URL'den seçilebilen bir mock kayıt veya başka öğrencinin verisine
  // erişilebilen genel amaçlı bir uç nokta DEĞİLDİR.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/parent/me")
      .then((res) => {
        if (!res.ok) throw new Error("Veli bilgileri alınamadı.");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setParentName(data.name ?? "");
        setStudents(data.students ?? []);
        if (data.students?.[0]) setSelectedStudentId(data.students[0].id);
      })
      .catch(() => {
        if (!cancelled) setError("Veli bilgileri yüklenemedi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const detail = students.find((s) => s.id === selectedStudentId) ?? null;

  return (
    <main className="flex min-h-screen flex-col dark:bg-transparent bg-cream px-6 py-8">
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b border-hairline bg-white/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md dark:border-white/5 dark:bg-midnight/80">
        <div className="flex items-center gap-2">
          <GlowLogo size="h-8 w-8" textSize="text-sm" innerClassName="bg-espresso dark:bg-midnight" />
          <span className={cn(spaceGrotesk.className, "hidden text-sm font-semibold text-espresso sm:inline dark:text-cream")}>Routinix Kampüs</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1.5 text-brand-700 backdrop-blur-sm dark:text-brand-300 sm:flex">
            <span className="text-sm font-medium">{parentName || "Veli"}</span>
            <span className="text-xs opacity-50">·</span>
            <span className="text-xs opacity-80">Veli Paneli</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 backdrop-blur-sm transition hover:border-red-400/30 hover:bg-red-500/10 dark:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 pt-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className={cn(spaceGrotesk.className, "mb-2 text-2xl font-bold text-espresso dark:text-cream")}>Veli Paneli</h1>
          <p className="mb-8 text-sm text-espresso-muted dark:text-cream/60">
            Sisteme bağlı öğrencilerinizin akademik performansını görüntüleyin.
          </p>

          {students.length > 1 && (
            <div className="mb-8 rounded-2xl border border-hairline bg-white p-6 shadow-sm dark:border-white/5 dark:bg-midnight-card/50 dark:backdrop-blur-sm">
              <label htmlFor="student-select" className="mb-3 block text-sm font-medium text-espresso dark:text-cream">
                Öğrenci Seç
              </label>
              <select
                id="student-select"
                value={selectedStudentId ?? ""}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-espresso outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-white/20 dark:bg-midnight-card/50 dark:text-cream"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} ({s.branchName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <AnimatePresence mode="wait">
            {loading ? (
              <EmptyState msg="Yükleniyor…" />
            ) : error ? (
              <EmptyState msg={error} />
            ) : students.length === 0 ? (
              <EmptyState msg="Sisteme bağlı bir öğrenci bulunamadı." />
            ) : detail ? (
              <div key={detail.id}>
                {/* Sekme çubuğu — kaydırılabilir, mobilde de tek satır. */}
                <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl bg-cream-card p-1 dark:bg-white/5">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                        tab === t.id
                          ? "bg-espresso text-cream dark:bg-brand-600"
                          : "text-espresso-muted hover:bg-white/60 dark:text-cream/40 dark:hover:bg-white/5"
                      )}
                    >
                      <t.icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Sekmeler TEMBEL yüklenir: her sekme kendi isteğini
                    ancak açıldığında atar. Veli panelini açmak beş uca
                    aynı anda gitmek demek olmasın. */}
                {tab === "attendance" && <ParentAttendanceTab studentId={detail.id} />}
                {tab === "exams" && <ParentExamsTab studentId={detail.id} />}
                {tab === "homework" && <ParentHomeworkTab studentId={detail.id} />}
                {tab === "announcements" && <ParentAnnouncementsTab studentId={detail.id} />}

                {tab === "overview" && (
                  <>
                <PerformanceCard detail={detail} />
                {detail.grade >= XRAY_MIN_GRADE && <XrayParentSummaryCard studentId={detail.id} />}
                {/* Ödeme Takip (Hub'daki 5. modül) — velinin salt-okunur
                    taksit/ödeme görünümüne giriş noktası. Veli hub'ı
                    kullanmadığı için modül buradan açılır. */}
                <button
                  onClick={() => router.push("/payments/parent")}
                  className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5 text-left transition hover:bg-emerald-500/10 dark:border-emerald-400/20"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block text-base font-semibold text-espresso dark:text-cream">Ödemelerim</span>
                      <span className="block text-xs text-espresso-muted dark:text-cream/40">Taksit planı ve ödeme geçmişini görüntüle.</span>
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                </button>
                  </>
                )}
              </div>
            ) : (
              <EmptyState msg="Öğrenci verisi yükleniyor…" />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-white/20"
    >
      <Users className="mx-auto mb-4 h-16 w-16 text-gray-300 dark:text-gray-600" />
      <p className="text-sm text-espresso-muted dark:text-cream/60">{msg}</p>
    </motion.div>
  );
}

function PerformanceCard({ detail }: { detail: StudentDetail }) {
  return (
    <motion.div
      key={detail.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="rounded-2xl border border-hairline bg-white p-6 shadow-sm transition-colors duration-300 dark:border-white/5 dark:bg-midnight-card/50 dark:backdrop-blur-sm dark:hover:border-brand-500/20"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-espresso/8 text-espresso dark:bg-brand-500/10 dark:text-brand-400">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div>
          <p className="text-base font-semibold text-espresso dark:text-cream">
            {detail.firstName} {detail.lastName}
          </p>
          <p className="text-xs text-espresso-muted dark:text-cream/40">
            {detail.branchName} · {detail.grade}. Sınıf
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat icon={Target} label="Güncel Net" value={detail.actualNet != null ? detail.actualNet.toString() : "—"} />
        <Stat icon={Target} label="Hedef Net" value={detail.targetNet != null ? detail.targetNet.toString() : "—"} />
        <Stat icon={CalendarCheck2} label="Devam Oranı" value={`%${Math.round(detail.attendanceRate)}`} />
      </div>
    </motion.div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-transparent bg-cream-card p-4 text-center transition-colors duration-300 dark:border-white/5 dark:bg-white/[0.03] dark:hover:border-brand-500/20">
      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold text-espresso dark:text-cream">{value}</p>
      <p className="text-xs text-espresso-muted dark:text-cream/40">{label}</p>
    </div>
  );
}
