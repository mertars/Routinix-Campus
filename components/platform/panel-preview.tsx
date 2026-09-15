"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Presentation,
  BookOpen,
  Users,
  HeartHandshake,
  Monitor,
  Tablet,
  Smartphone,
  RotateCw,
  ExternalLink,
  X,
  Lock,
  Pencil,
  Loader2,
} from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// PANEL ÖNİZLEMESİ — beş panelin GERÇEK halini /platform'dan tek tıkla açar.
//
// Neden iframe (kopya/anlık görüntü değil): panel GERÇEK rotanın (/principal,
// /teacher, ...) kendisidir. Yani her push'tan sonra "önizlemeyi yenileme"
// diye bir iş YOKTUR — burada görülen her zaman canlıdaki sürümdür.
//
// Neden telefon görünümü gerçek: bir <iframe> KENDİ viewport'una sahiptir.
// 390px genişlikte bir iframe'de Tailwind'in sm:/md: kırılma noktaları
// eşleşmez — yani burada görünen düzen, gerçek bir telefondaki düzenin
// AYNISIDIR, taklidi değil.
//
// 🔒 Oturum tamamen sunucuda: httpOnly bir önizleme cookie'si (bkz.
// app/api/platform/preview/route.ts). Bu bileşen hiçbir token görmez/tutmaz.
// ----------------------------------------------------------------------------

type InstitutionOption = { id: string; name: string };
type PreviewUser = { id: string; name: string; detail: string };
type RoleId = "principal" | "teacher" | "student" | "parent" | "guidance";

// Kaynak kaydı deseni (bkz. CLAUDE.md): yeni bir persona eklenirse buraya
// BİR SATIR eklenir, aşağıdaki hiçbir kod dallandırılmaz.
const ROLES: { id: RoleId; label: string; icon: typeof Briefcase; accent: string }[] = [
  { id: "principal", label: "Yönetici", icon: Briefcase, accent: "text-amber-600 dark:text-amber-400" },
  { id: "teacher", label: "Öğretmen", icon: Presentation, accent: "text-sky-600 dark:text-sky-400" },
  { id: "student", label: "Öğrenci", icon: BookOpen, accent: "text-emerald-600 dark:text-emerald-400" },
  { id: "parent", label: "Veli", icon: Users, accent: "text-violet-600 dark:text-violet-400" },
  { id: "guidance", label: "Rehberlik", icon: HeartHandshake, accent: "text-rose-600 dark:text-rose-400" },
];

// Gerçek cihaz ölçüleri — iframe bu genişlikte render edildiği için
// uygulamanın kendi kırılma noktaları doğal olarak devreye girer.
const DEVICES = {
  desktop: { label: "Masaüstü", icon: Monitor, width: null as number | null, height: null as number | null },
  tablet: { label: "Tablet", icon: Tablet, width: 834, height: 1112 },
  phone: { label: "Telefon", icon: Smartphone, width: 390, height: 844 },
};
type DeviceId = keyof typeof DEVICES;

/** Cihaz çerçevesinin kalınlığı (px) — ölçek hesabına DAHİL edilmeli. */
const BEZEL = 10;

type ActiveSession = {
  url: string;
  role: RoleId;
  roleLabel: string;
  institutionName: string;
  user: PreviewUser;
};

export function PanelPreview({
  isOpen,
  onClose,
  institutions,
  initialInstitutionId,
}: {
  isOpen: boolean;
  onClose: () => void;
  institutions: InstitutionOption[];
  initialInstitutionId?: string | null;
}) {
  const { showError } = useToast();
  const [institutionId, setInstitutionId] = useState("");
  const [role, setRole] = useState<RoleId | null>(null);
  const [users, setUsers] = useState<PreviewUser[]>([]);
  const [device, setDevice] = useState<DeviceId>("desktop");
  const [session, setSession] = useState<ActiveSession | null>(null);
  // Yazma modu — VARSAYILAN KAPALI ve her açılışta kapalı başlar
  // (gerçek müşteri verisine yanlışlıkla yazmayı önleyen asıl önlem budur;
  // bkz. lib/server/auth/preview-jwt.ts > canWrite).
  const [canWrite, setCanWrite] = useState(false);
  const [starting, setStarting] = useState<RoleId | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [stageHeight, setStageHeight] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) setInstitutionId((current) => current || initialInstitutionId || institutions[0]?.id || "");
  }, [isOpen, initialInstitutionId, institutions]);

  // Cihaz çerçevesini ekrana sığdırmak için ölçek hesaplanır (844px'lik bir
  // telefon çoğu dizüstü ekranına olduğu gibi sığmaz). ResizeObserver, pencere
  // yeniden boyutlandığında da doğru kalmasını sağlar.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setStageHeight(entry.contentRect.height));
    observer.observe(el);
    setStageHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [isOpen, session]);

  // Önizlemeyi (yeniden) açan TEK yol — rol tuşu, kullanıcı değiştirme ve
  // kurum değiştirme hep buradan geçer. targetInstitutionId parametresi var
  // çünkü kurum değiştirildiği anda state henüz güncellenmemiş olur
  // (setState asenkron), o yüzden yeni kurum doğrudan geçirilir.
  const startPreview = useCallback(
    async (nextRole: RoleId, options?: { userId?: string; institutionId?: string; write?: boolean }) => {
      const targetInstitutionId = options?.institutionId ?? institutionId;
      if (!targetInstitutionId) return;
      // Yazma modu token'ın İÇİNDE taşınır, yani modu değiştirmek token'ı
      // yeniden üretmek demektir — istemci tarafında çevrilebilen bir bayrak
      // olsaydı hiçbir şey ifade etmezdi.
      const write = options?.write ?? canWrite;
      setStarting(nextRole);
      try {
        const res = await fetch("/api/platform/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ institutionId: targetInstitutionId, role: nextRole, userId: options?.userId, write }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Önizleme açılamadı.");
        setRole(nextRole);
        setSession({
          url: data.url,
          role: nextRole,
          roleLabel: data.roleLabel,
          institutionName: data.institutionName,
          user: data.user,
        });
        setCanWrite(data.canWrite === true);
        setIframeKey((k) => k + 1);
      } catch (error) {
        setSession(null);
        showError(error instanceof Error ? error.message : "Önizleme açılamadı.");
      } finally {
        setStarting(null);
      }
    },
    [institutionId, showError, canWrite]
  );

  // Rol/kurum değiştikçe o role ait gerçek hesap listesi tazelenir —
  // "hangi öğretmenin gözünden bakıyorum" seçilebilsin diye.
  useEffect(() => {
    if (!isOpen || !institutionId || !role) {
      setUsers([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/platform/preview/users?institutionId=${encodeURIComponent(institutionId)}&role=${role}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) setUsers(d.users ?? []);
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, institutionId, role]);

  const stopPreview = useCallback(async () => {
    // Cookie'nin silinmesi SUNUCUDA olur (httpOnly) — kapatınca önizleme
    // oturumu gerçekten biter, sadece ekran kapanmaz.
    await fetch("/api/platform/preview", { method: "DELETE" }).catch(() => {});
    setSession(null);
    setRole(null);
    setUsers([]);
    onClose();
  }, [onClose]);

  // Kurum değişirse açık önizleme artık o kuruma ait DEĞİLDİR — aynı rolle
  // yeni kurumda yeniden açılır. Sessizce eski kurumu göstermeye devam etmek,
  // "hangi kurumun verisine bakıyorum" sorusunu belirsizleştirirdi.
  function handleInstitutionChange(nextId: string) {
    setInstitutionId(nextId);
    setSession(null);
    if (role) void startPreview(role, { institutionId: nextId });
  }

  if (!isOpen) return null;

  const preset = DEVICES[device];
  // Çerçeve ekrana sığmıyorsa küçültülür; asla BÜYÜTÜLMEZ (1'i aşmaz),
  // aksi halde telefon görünümü gerçekte olduğundan iri görünürdü.
  const scale = preset.height && stageHeight ? Math.min(1, (stageHeight - 32) / (preset.height + BEZEL * 2)) : 1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-cream dark:bg-midnight"
      >
        {/* --- Kontrol çubuğu --- */}
        <div className="shrink-0 border-b border-hairline bg-white/80 backdrop-blur-sm dark:border-white/10 dark:bg-midnight-card/70">
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
            {/* ⚠️ Mod düğmesi ve rozeti AYNI şey — kırmızı olduğunda gerçek
                müşteri verisine yazıyorsunuz demektir. Kapalıyken kehribar,
                açıkken kırmızı: tek bakışta ayırt edilsin diye. Mod token'ın
                içinde taşınır, yani düğme sadece görsel değil (bkz.
                lib/server/auth/preview-jwt.ts > canWrite). */}
            <button
              onClick={() => session && startPreview(session.role, { userId: session.user.id, write: !canWrite })}
              disabled={!session || !!starting}
              title={canWrite ? "Salt okunura dön" : "Yazma modunu aç — gerçek veri değişir"}
              className={cn(
                "flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-bold uppercase tracking-wide transition disabled:opacity-60",
                canWrite
                  ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
                  : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300"
              )}
            >
              {canWrite ? <Pencil className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {canWrite ? "Yazma Modu Açık" : "Salt Okunur"}
            </button>

            <select
              value={institutionId}
              onChange={(e) => handleInstitutionChange(e.target.value)}
              className="min-h-[36px] max-w-[190px] rounded-lg border border-hairline bg-white px-2.5 text-xs font-medium text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>

            <div className="flex flex-wrap items-center gap-1 rounded-xl bg-cream-card p-1 dark:bg-white/5">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = session?.role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => startPreview(r.id)}
                    disabled={!!starting}
                    className={cn(
                      "flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition disabled:opacity-60",
                      isActive
                        ? "bg-white text-espresso shadow-sm dark:bg-midnight-card dark:text-cream"
                        : "text-espresso-muted hover:text-espresso dark:text-cream/50 dark:hover:text-cream"
                    )}
                  >
                    {starting === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className={cn("h-3.5 w-3.5", isActive ? r.accent : "")} />
                    )}
                    {r.label}
                  </button>
                );
              })}
            </div>

            {session && users.length > 1 && (
              <select
                value={session.user.id}
                onChange={(e) => startPreview(session.role, { userId: e.target.value })}
                className="min-h-[36px] max-w-[220px] rounded-lg border border-hairline bg-white px-2.5 text-xs text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.detail}
                  </option>
                ))}
              </select>
            )}

            <div className="ml-auto flex items-center gap-1">
              <div className="flex items-center gap-0.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
                {(Object.keys(DEVICES) as DeviceId[]).map((id) => {
                  const Icon = DEVICES[id].icon;
                  return (
                    <button
                      key={id}
                      onClick={() => setDevice(id)}
                      title={DEVICES[id].label}
                      className={cn(
                        "flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition",
                        device === id
                          ? "bg-white text-brand-600 shadow-sm dark:bg-midnight-card"
                          : "text-espresso-muted hover:text-espresso dark:text-cream/40 dark:hover:text-cream"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setIframeKey((k) => k + 1)}
                disabled={!session}
                title="Yenile"
                className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-espresso-muted transition hover:bg-cream-card hover:text-espresso disabled:opacity-40 dark:text-cream/40 dark:hover:bg-white/5 dark:hover:text-cream"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <a
                href={session?.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                title="Yeni sekmede aç"
                className={cn(
                  "flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-espresso-muted transition hover:bg-cream-card hover:text-espresso dark:text-cream/40 dark:hover:bg-white/5 dark:hover:text-cream",
                  !session && "pointer-events-none opacity-40"
                )}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                onClick={stopPreview}
                className="flex min-h-[36px] items-center gap-1.5 rounded-lg border border-red-400/20 bg-red-500/5 px-3 text-xs font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
              >
                <X className="h-3.5 w-3.5" /> Kapat
              </button>
            </div>
          </div>

          {session && (
            <p
              className={cn(
                "truncate border-t px-3 py-1.5 text-[11px] sm:px-4",
                canWrite
                  ? "border-red-500/30 bg-red-500/10 font-medium text-red-700 dark:text-red-300"
                  : "border-hairline text-espresso-muted dark:border-white/5 dark:text-cream/40"
              )}
            >
              <span className={cn("font-semibold", canWrite ? "" : "text-espresso dark:text-cream")}>{session.institutionName}</span> ·{" "}
              {session.roleLabel} · {session.user.name}
              {session.user.detail ? ` (${session.user.detail})` : ""} · <span className="font-mono">{session.url}</span>
              {canWrite
                ? " — YAZMA MODU AÇIK: burada yaptığınız her değişiklik bu kurumun GERÇEK verisine işlenir."
                : " — bu ekran canlı sürümün kendisidir, veri değiştirilemez."}
            </p>
          )}
        </div>

        {/* --- Sahne --- */}
        <div ref={stageRef} className="relative min-h-0 flex-1 overflow-auto bg-cream-muted/40 p-4 dark:bg-black/30">
          {!session ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-medium text-espresso dark:text-cream">Hangi panele bakmak istersiniz?</p>
              <p className="max-w-md text-xs text-espresso-muted dark:text-cream/40">
                Yukarıdan bir kurum ve rol seçin. Panel, o kurumun gerçek bir kullanıcısının gözünden — giriş yapmış biri gibi — açılır.
              </p>
            </div>
          ) : (
            // ⚠️ TEK bir iframe, TEK bir ağaç — cihaz değişince sadece
            // stiller değişir. Önce masaüstü ve telefon AYRI JSX dalları
            // olarak yazılmıştı; React o durumda iframe'i söküp yeniden
            // kuruyordu, yani her cihaz değişiminde panel BAŞTAN yükleniyor
            // ve boş beyaz bir çerçeve görünüyordu (2026-09-15 ekran
            // görüntüsüyle yakalandı). Ağaç şekli sabit kalınca iframe
            // korunur, geçiş anında olur.
            <div className="flex h-full justify-center">
              <div
                style={
                  preset.width === null
                    ? { width: "100%", height: "100%" }
                    : { width: (preset.width + BEZEL * 2) * scale, height: ((preset.height ?? 0) + BEZEL * 2) * scale }
                }
              >
                {/* Cihaz çerçevesi — iframe GERÇEK piksel ölçüsünde kalır,
                    sadece görsel olarak ölçeklenir; böylece uygulamanın
                    gördüğü viewport genişliği hep 390/834'tür.
                    ⚠️ boxSizing: "content-box" ŞART. Tailwind varsayılanı
                    border-box ve o haldeyken 10px'lik çerçeve genişliğin
                    İÇİNDEN yeniyordu: canlı ölçümde iframe'in iç viewport'u
                    390 değil 370px çıktı — yani "telefon önizlemesi" gerçek
                    bir telefonun genişliği DEĞİLDİ. content-box ile 390
                    içerik + 10 çerçeve. */}
                <div
                  style={
                    preset.width === null
                      ? { width: "100%", height: "100%" }
                      : {
                          width: preset.width,
                          height: preset.height ?? 0,
                          boxSizing: "content-box",
                          borderWidth: BEZEL,
                          transform: `scale(${scale})`,
                          transformOrigin: "top left",
                        }
                  }
                  className={cn(
                    "overflow-hidden bg-white dark:bg-midnight-card",
                    preset.width === null
                      ? "rounded-xl border border-hairline shadow-sm dark:border-white/10"
                      : "rounded-[2rem] border-solid border-espresso shadow-2xl dark:border-black"
                  )}
                >
                  <iframe
                    key={iframeKey}
                    src={session.url}
                    title={`${session.roleLabel} paneli önizlemesi`}
                    className="h-full w-full border-0 bg-white dark:bg-midnight"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rol/kullanıcı değişirken üstte net bir geçiş — aksi halde bir an
              ÖNCEKİ kimliğin paneli görünüyor ve hangi kimliğe bakıldığı
              belirsizleşiyor. */}
          {starting && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-cream-muted/70 backdrop-blur-[2px] dark:bg-black/50">
              <span className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-espresso shadow-lg dark:bg-midnight-card dark:text-cream">
                <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> Panel açılıyor...
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
