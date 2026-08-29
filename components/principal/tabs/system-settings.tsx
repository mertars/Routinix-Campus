"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock3, Save, Loader2, UserCog, ImageUp, Trash2, Building2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { useInstitutionName } from "@/lib/institution-scope";

const MAX_LOGO_BYTES = 2_000_000;

// Kampüs V2 Part 5 — "Logoyu Güncelle": dosya yükleme şimdilik gerçek bir
// dosya depolama servisi (S3/Blob vb.) OLMADAN, seçilen görseli tarayıcıda
// FileReader.readAsDataURL ile base64 data URI'a çevirip Institution.logoUrl
// alanına DOĞRUDAN yazarak "mock'lanıyor" (görev metninde bu şekilde
// belirtildi) — PDF üretimi (bkz. components/pdf/pdf-report-card.tsx) bu
// data URI'yı react-pdf'in <Image> bileşenine doğrudan verebiliyor, ayrı
// bir dosya sunucusu gerekmiyor.
function LogoUploadCard() {
  const institutionName = useInstitutionName();
  const { showError, showSuccess } = useToast();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/institution-logo")
      .then((res) => res.json())
      .then((data) => setLogoUrl(data.logoUrl ?? null))
      .catch(() => showError("Logo yüklenemedi."))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveLogo(nextLogoUrl: string | null) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/institution-logo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: nextLogoUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      setLogoUrl(data.logoUrl);
      showSuccess(nextLogoUrl ? "Logo güncellendi." : "Logo kaldırıldı.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  function handleFileChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Yalnızca görsel dosyaları yüklenebilir.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      showError("Logo görseli 2MB'dan büyük olamaz.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") saveLogo(reader.result);
    };
    reader.onerror = () => showError("Görsel okunamadı.");
    reader.readAsDataURL(file);
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <ImageUp className="h-4 w-4 text-brand-600" /> Kurum Logosu
      </h2>
      <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">
        Gelişim Karnesi gibi PDF çıktılarının sol üst köşesinde kurum adının yanında gösterilir.
      </p>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Kurum logosu" className="h-14 w-14 shrink-0 rounded-xl object-contain bg-cream-card dark:bg-white/5" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-espresso text-cream dark:bg-brand-600">
            <Building2 className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-espresso dark:text-cream">{institutionName}</p>
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">{logoUrl ? "Özel logo yüklü" : "Henüz logo yüklenmedi — kurum baş harfi kullanılıyor"}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => handleFileChange(event.target.files?.[0])} />
        <button
          onClick={() => fileInput.current?.click()}
          disabled={!loaded || saving}
          className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-espresso text-xs font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageUp className="h-3.5 w-3.5" />}
          {logoUrl ? "Logoyu Değiştir" : "Logo Yükle"}
        </button>
        {logoUrl && (
          <button
            onClick={() => saveLogo(null)}
            disabled={saving}
            className="flex min-h-[40px] items-center gap-1.5 rounded-xl border border-hairline px-3 text-xs font-medium text-espresso transition hover:bg-cream-card disabled:opacity-60 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Kaldır
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EtutSettingsCard() {
  const { showError, showSuccess } = useToast();
  const [duration, setDuration] = useState("20");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [isAdminManaged, setIsAdminManaged] = useState(true);
  const [managedLoaded, setManagedLoaded] = useState(false);
  const [savingManaged, setSavingManaged] = useState(false);

  useEffect(() => {
    fetch("/api/admin/etut-settings")
      .then((res) => res.json())
      .then((data) => setDuration(String(data.durationMinutes ?? 20)))
      .catch(() => showError("Etüt ayarı yüklenemedi."))
      .finally(() => setLoaded(true));
    fetch("/api/admin/institution-settings")
      .then((res) => res.json())
      .then((data) => setIsAdminManaged(data.isEtutAdminManaged ?? true))
      .catch(() => showError("Etüt yönetim ayarı yüklenemedi."))
      .finally(() => setManagedLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/etut-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: Number(duration) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Etüt süresi güncellendi.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAdminManaged() {
    const next = !isAdminManaged;
    setIsAdminManaged(next);
    setSavingManaged(true);
    try {
      const res = await fetch("/api/admin/institution-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isEtutAdminManaged: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess(next ? "Etütler artık yönetici tarafından belirlenecek." : "Öğretmen ve öğrenciler kendi etüt randevusunu yönetebilir.");
    } catch (error) {
      setIsAdminManaged(!next);
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSavingManaged(false);
    }
  }

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -3 }}
      className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
    >
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-espresso dark:text-cream">
        <Clock3 className="h-4 w-4 text-brand-600" /> Etüt Randevu Ayarları
      </h2>
      <p className="mb-4 text-xs text-espresso-muted dark:text-cream/40">
        Kurum genelinde tek bir etüt süresi kullanılır — öğretmenlerin müsaitlik aralıkları bu süreye göre slotlara bölünür.
      </p>
      <div className="mb-4 flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
            Etüt Süresi (dakika)
          </span>
          <input
            type="number"
            min={5}
            max={180}
            step={5}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            disabled={!loaded}
            className="w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-sm text-espresso outline-none focus:border-brand-600 disabled:opacity-60 dark:border-white/10 dark:bg-midnight dark:text-cream"
          />
        </label>
        <button
          onClick={save}
          disabled={saving || !loaded}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-espresso px-4 text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-cream-card p-3.5 dark:bg-white/5">
        <div className="flex items-start gap-2 pr-4">
          <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <div>
            <p className="text-sm font-medium text-espresso dark:text-cream">Etütleri Yönetim Belirler</p>
            <p className="text-xs text-espresso-muted dark:text-cream/40">
              Açık olduğunda öğretmen/öğrenci kendi etüt randevusunu alamaz/onaylayamaz — tüm atama &quot;Etüt Yönetimi&quot; ekranından yapılır.
            </p>
          </div>
        </div>
        <button
          onClick={toggleAdminManaged}
          disabled={!managedLoaded || savingManaged}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            isAdminManaged ? "bg-espresso dark:bg-brand-600" : "bg-hairline dark:bg-white/10"
          }`}
        >
          <motion.span
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
            animate={{ left: isAdminManaged ? "22px" : "2px" }}
            transition={{ duration: 0.2 }}
          />
        </button>
      </div>
    </motion.div>
  );
}

const TOGGLES = [
  {
    id: "autoNudge",
    label: "Otomatik Nudge",
    description: "Gecikmiş görevlerde öğrenciye otomatik hatırlatma gönder",
    defaultValue: true,
  },
  {
    id: "weeklyBriefing",
    label: "Haftalık Brifing E-postası",
    description: "Pazartesi sabahı özet e-postası gönder",
    defaultValue: true,
  },
  {
    id: "riskAlerts",
    label: "Risk Skoru Bildirimleri",
    description: "Riskli öğrenci tespit edildiğinde anlık bildirim",
    defaultValue: false,
  },
] as const;

export function SystemSettingsTab() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(TOGGLES.map((toggle) => [toggle.id, toggle.defaultValue]))
  );

  return (
    <div className="space-y-4">
      <LogoUploadCard />
      <EtutSettingsCard />

      <motion.div
        whileHover={{ scale: 1.01, y: -3 }}
        className="rounded-3xl border border-hairline bg-white/70 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/50 dark:hover:border-brand-500/30"
      >
        <h2 className="mb-4 text-sm font-semibold text-espresso dark:text-cream">Nudge Parametreleri</h2>
        <div className="divide-y divide-hairline dark:divide-white/10">
          {TOGGLES.map((toggle) => (
            <div key={toggle.id} className="flex items-center justify-between py-3">
              <div className="pr-4">
                <p className="text-sm font-medium text-espresso dark:text-cream">{toggle.label}</p>
                <p className="text-xs text-espresso-muted dark:text-cream/40">{toggle.description}</p>
              </div>
              <button
                onClick={() => setToggles((prev) => ({ ...prev, [toggle.id]: !prev[toggle.id] }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  toggles[toggle.id] ? "bg-espresso dark:bg-brand-600" : "bg-hairline dark:bg-white/10"
                }`}
              >
                <motion.span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                  animate={{ left: toggles[toggle.id] ? "22px" : "2px" }}
                  transition={{ duration: 0.2 }}
                />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
