"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Building2, Users, UserCog2, Layers, LogOut, Loader2, Copy, Check, ShieldAlert, X, Scan, Activity, ListChecks } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { XrayQuestionPoolWizard } from "@/components/platform/xray-question-pool-wizard";
import { XrayPoolGenerationDashboard } from "@/components/platform/xray-pool-generation-dashboard";
import { XrayPoolQuestionsBrowser } from "@/components/platform/xray-pool-questions-browser";
import { useToast } from "@/lib/toast-context";
import { spaceGrotesk, GlowLogo } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// xlsx büyük bir kütüphane — sadece bir kurum kartına gerçekten tıklandığında
// (nadir bir işlem) ayrı bir chunk olarak yüklensin diye dinamik import
// ediliyor (bkz. components/principal/user-management/bulk-import-wizard.tsx'teki
// AYNI desen) — aksi halde /platform panosunun ilk yüklemesi ~140KB şişerdi.
const InstitutionDetailModal = dynamic(
  () => import("@/components/platform/institution-detail-modal").then((mod) => mod.InstitutionDetailModal),
  { ssr: false }
);

type InstitutionRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  studentCount: number;
  teacherCount: number;
  branchCount: number;
};

type NewInstitutionCredentials = { institutionName: string; adminName: string; username: string; password: string };

const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";

function CreateInstitutionModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (credentials: NewInstitutionCredentials) => void;
}) {
  const { showError } = useToast();
  const [name, setName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminTitle, setAdminTitle] = useState("Kurum Müdürü");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isValid = name.trim() && adminName.trim() && adminTitle.trim() && adminPhone.trim() && adminEmail.trim();

  function reset() {
    setName("");
    setAdminName("");
    setAdminTitle("Kurum Müdürü");
    setAdminPhone("");
    setAdminEmail("");
  }

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/platform/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, adminName, adminTitle, adminPhone, adminEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kurum oluşturulamadı.");
      onCreated({ institutionName: data.institution.name, adminName, username: data.admin.username, password: data.admin.password });
      reset();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kurum oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Kurum Aç">
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='Kurum Adı (örn. "Yıldız Dershanesi")' className={inputClass} />
        <div className="border-t border-hairline pt-3 dark:border-white/10">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">İlk Yönetici Hesabı</p>
          <div className="space-y-2">
            <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Ad Soyad" className={inputClass} />
            <input value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} placeholder="Unvan (örn. Kurum Müdürü)" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="GSM" className={inputClass} />
              <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="E-posta" className={inputClass} />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {submitting ? "Oluşturuluyor..." : "Kurumu Oluştur"}
      </button>
    </Modal>
  );
}

function CredentialsOnceModal({ credentials, onClose }: { credentials: NewInstitutionCredentials | null; onClose: () => void }) {
  const { showError } = useToast();
  const [copied, setCopied] = useState<"username" | "password" | null>(null);

  async function copy(field: "username" | "password", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(field);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      showError("Panoya kopyalanamadı.");
    }
  }

  return (
    <Modal isOpen={!!credentials} onClose={onClose} title="Kurum Oluşturuldu" variant="center">
      {credentials && (
        <div>
          <p className="mb-4 text-center text-sm text-espresso-muted dark:text-cream/40">
            <span className="font-semibold text-espresso dark:text-cream">{credentials.institutionName}</span> için{" "}
            <span className="font-semibold text-espresso dark:text-cream">{credentials.adminName}</span> hesabı hazır.
          </p>

          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
            <span className="min-w-0 truncate text-xs text-espresso dark:text-cream">
              <span className="text-espresso-muted dark:text-cream/40">Kullanıcı Adı: </span>
              <span className="font-mono font-semibold">{credentials.username}</span>
            </span>
            <button onClick={() => copy("username", credentials.username)} className="shrink-0 text-espresso-muted hover:text-brand-600 dark:text-cream/40">
              {copied === "username" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-cream-card px-3 py-2.5 dark:bg-white/5">
            <span className="min-w-0 truncate text-xs text-espresso dark:text-cream">
              <span className="text-espresso-muted dark:text-cream/40">Geçici Şifre: </span>
              <span className="font-mono font-semibold">{credentials.password}</span>
            </span>
            <button onClick={() => copy("password", credentials.password)} className="shrink-0 text-espresso-muted hover:text-brand-600 dark:text-cream/40">
              {copied === "password" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mb-4 flex items-start gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-[10px] text-brand-700 dark:bg-brand-600/10 dark:text-brand-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Bu şifre sadece bir kez gösterilir. Kurumun yöneticisine güvenli bir kanaldan (yüz yüze,
            şifreli mesaj) iletin — telefon + bu şifreyle giriş yapıp kalıcı bir şifre belirleyecek.
          </div>

          <button
            onClick={onClose}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            <X className="h-4 w-4" /> Kapat
          </button>
        </div>
      )}
    </Modal>
  );
}

export default function PlatformDashboardPage() {
  const router = useRouter();
  const { showError } = useToast();
  const [institutions, setInstitutions] = useState<InstitutionRow[] | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<NewInstitutionCredentials | null>(null);
  const [detailInstitutionId, setDetailInstitutionId] = useState<string | null>(null);
  const [isQuestionPoolOpen, setIsQuestionPoolOpen] = useState(false);
  const [isGenerationDashboardOpen, setIsGenerationDashboardOpen] = useState(false);
  const [isQuestionsBrowserOpen, setIsQuestionsBrowserOpen] = useState(false);

  async function loadInstitutions() {
    try {
      const res = await fetch("/api/platform/institutions");
      if (res.status === 401) {
        router.replace("/platform/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setInstitutions(data.institutions ?? []);
    } catch {
      showError("Kurum listesi yüklenemedi.");
    }
  }

  useEffect(() => {
    loadInstitutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await fetch("/api/platform/logout", { method: "POST" }).catch(() => {});
    router.push("/platform/login");
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-8 dark:bg-midnight sm:px-8 md:px-16">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GlowLogo innerClassName="bg-espresso dark:bg-midnight" />
            <div>
              <span className={cn(spaceGrotesk.className, "block text-lg font-semibold text-espresso dark:text-cream")}>Routinix Kampüs</span>
              <span className="text-[11px] font-medium uppercase tracking-wide text-espresso-muted dark:text-cream/40">Platform Yönetimi</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
          >
            <LogOut className="h-3.5 w-3.5" /> Çıkış Yap
          </button>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-espresso dark:text-cream">Kurumlar</h1>
            <p className="text-xs text-espresso-muted dark:text-cream/40">
              {institutions ? `${institutions.length} kurum · kurulum yapmak/hesapları görmek için bir karta tıkla` : "Yükleniyor..."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsGenerationDashboardOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-medium text-violet-700 transition hover:bg-violet-500/20 dark:text-violet-300"
            >
              <Activity className="h-4 w-4" /> Soru Havuzu Üretim Paneli
            </button>
            <button
              onClick={() => setIsQuestionsBrowserOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <ListChecks className="h-4 w-4" /> Soruları Görüntüle / Düzenle
            </button>
            <button
              onClick={() => setIsQuestionPoolOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-500/20 dark:text-sky-300"
            >
              <Scan className="h-4 w-4" /> Röntgen Soru Havuzu Yükle
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-espresso px-4 py-2.5 text-sm font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
            >
              <Plus className="h-4 w-4" /> Yeni Kurum Aç
            </button>
          </div>
        </div>

        {institutions === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : institutions.length === 0 ? (
          <p className="rounded-2xl bg-cream-card px-4 py-10 text-center text-sm text-espresso-muted dark:bg-white/5 dark:text-cream/40">
            Henüz hiç kurum yok — &quot;Yeni Kurum Aç&quot; ile ilk dershaneyi ekleyin.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {institutions.map((inst, index) => (
                <motion.div
                  key={inst.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setDetailInstitutionId(inst.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setDetailInstitutionId(inst.id)}
                  className="cursor-pointer rounded-2xl border border-hairline bg-white/70 p-4 backdrop-blur-sm transition hover:border-brand-500/40 dark:border-white/10 dark:bg-midnight-card/50"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-brand-600" />
                      <p className="text-sm font-semibold text-espresso dark:text-cream">{inst.name}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        inst.isActive ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400" : "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                      )}
                    >
                      {inst.isActive ? "Aktif" : "Askıya Alınmış"}
                    </span>
                  </div>
                  <p className="mb-3 font-mono text-[11px] text-espresso-muted dark:text-cream/40">{inst.slug}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-cream-card py-2 dark:bg-white/5">
                      <p className="flex items-center justify-center gap-1 text-sm font-bold text-espresso dark:text-cream">
                        <Users className="h-3 w-3 text-brand-600" /> {inst.studentCount}
                      </p>
                      <p className="text-[9px] text-espresso-muted dark:text-cream/40">Öğrenci</p>
                    </div>
                    <div className="rounded-lg bg-cream-card py-2 dark:bg-white/5">
                      <p className="flex items-center justify-center gap-1 text-sm font-bold text-espresso dark:text-cream">
                        <UserCog2 className="h-3 w-3 text-brand-600" /> {inst.teacherCount}
                      </p>
                      <p className="text-[9px] text-espresso-muted dark:text-cream/40">Öğretmen</p>
                    </div>
                    <div className="rounded-lg bg-cream-card py-2 dark:bg-white/5">
                      <p className="flex items-center justify-center gap-1 text-sm font-bold text-espresso dark:text-cream">
                        <Layers className="h-3 w-3 text-brand-600" /> {inst.branchCount}
                      </p>
                      <p className="text-[9px] text-espresso-muted dark:text-cream/40">Şube</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <CreateInstitutionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(credentials) => {
          setNewCredentials(credentials);
          loadInstitutions();
        }}
      />
      <CredentialsOnceModal credentials={newCredentials} onClose={() => setNewCredentials(null)} />
      <InstitutionDetailModal institutionId={detailInstitutionId} onClose={() => setDetailInstitutionId(null)} />
      <XrayQuestionPoolWizard isOpen={isQuestionPoolOpen} onClose={() => setIsQuestionPoolOpen(false)} />
      <XrayPoolGenerationDashboard isOpen={isGenerationDashboardOpen} onClose={() => setIsGenerationDashboardOpen(false)} />
      <XrayPoolQuestionsBrowser isOpen={isQuestionsBrowserOpen} onClose={() => setIsQuestionsBrowserOpen(false)} />
    </main>
  );
}
