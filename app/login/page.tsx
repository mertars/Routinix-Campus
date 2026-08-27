"use client";

import { FormEvent, useEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Fingerprint,
  KeyRound,
  Layers,
  Lock,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRole } from "@/lib/role-context";
import type { RoleId } from "@/lib/mock-data";
import { OtpInput } from "@/components/ui/otp-input";
import { AuroraOrbs, GlowLogo, spaceGrotesk, AURORA_GRID_STYLE } from "@/components/ui/aurora-brand";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------------
// Giriş akışı — TEK state makinesi (useReducer). Her adım geçişi, o adıma ait
// OLMAYAN alanları (kod, devOtp, token, şifre...) sıfırlar; böylece eski bir
// adımın kalıntı state'i sonraki ekranla çakışamaz.
//
// Rol (RoleId), component state'i DEĞİL — doğrudan URL'nin ?role= parametresinden
// türetilir ve akış boyunca hiç değişmez; bir ROLE_MISMATCH hatasından sonra
// bile sıfırlanamaz, bu yüzden rol kontrolü ikinci bir denemede asla atlanamaz.
//
// Şifre değiştirme token'ı ("passwordChangeToken") üç farklı olaydan gelebilir:
//   - OTP doğrulandı, hesabın hiç şifresi yoktu           (ilk giriş)
//   - OTP doğrulandı, "Şifremi Unuttum" ile               (şifre sıfırlama)
//   - Doğru (geçici) şifre girildi, mustChangePassword=true (zorunlu değişim,
//     OTP'ye hiç gerek yok — doğru şifreyi bilmek zaten kanıttır)
// Üçü de aynı "password-new" ekranına ve aynı /api/auth/set-password ucuna çıkar.
// ----------------------------------------------------------------------------

const VALID_ROLES: RoleId[] = ["principal", "teacher", "student", "parent"];
const ROLE_LABEL_TR: Record<RoleId, string> = {
  principal: "Yönetici",
  teacher: "Öğretmen",
  student: "Öğrenci",
  parent: "Veli",
};

type Step = "phone" | "otp" | "password-new" | "password-login";
type Intent = "login" | "reset";

type State = {
  step: Step;
  intent: Intent;
  phone: string;
  code: string;
  password: string;
  confirmPassword: string;
  devOtp: string | null;
  passwordChangeToken: string | null;
  error: string | null;
  info: string | null;
  loading: boolean;
};

const initialState: State = {
  step: "phone",
  intent: "login",
  phone: "",
  code: "",
  password: "",
  confirmPassword: "",
  devOtp: null,
  passwordChangeToken: null,
  error: null,
  info: null,
  loading: false,
};

type Action =
  | { type: "SET_PHONE"; value: string }
  | { type: "SET_CODE"; value: string }
  | { type: "SET_PASSWORD"; value: string }
  | { type: "SET_CONFIRM_PASSWORD"; value: string }
  | { type: "SUBMIT" }
  | { type: "FAIL"; message: string }
  | { type: "START_NEEDS_OTP"; devOtp: string | null; intent: Intent }
  | { type: "START_NEEDS_PASSWORD" }
  | { type: "OTP_VERIFIED"; token: string }
  | { type: "PASSWORD_LOGIN_NEEDS_CHANGE"; token: string }
  | { type: "BACK_TO_PHONE" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_PHONE":
      return { ...state, phone: action.value, error: null };
    case "SET_CODE":
      return { ...state, code: action.value, error: null };
    case "SET_PASSWORD":
      return { ...state, password: action.value, error: null };
    case "SET_CONFIRM_PASSWORD":
      return { ...state, confirmPassword: action.value, error: null };
    case "SUBMIT":
      return { ...state, loading: true, error: null };
    case "FAIL":
      return { ...state, loading: false, error: action.message };
    case "START_NEEDS_OTP":
      return {
        ...state,
        loading: false,
        step: "otp",
        intent: action.intent,
        code: "",
        devOtp: action.devOtp,
        info: action.devOtp ? "Geliştirme modu: SMS yerine kod aşağıda gösteriliyor." : "Kod telefonunuza SMS ile gönderildi.",
      };
    case "START_NEEDS_PASSWORD":
      return { ...state, loading: false, step: "password-login", devOtp: null, passwordChangeToken: null, password: "", info: null };
    case "OTP_VERIFIED":
      return { ...state, loading: false, step: "password-new", passwordChangeToken: action.token, code: "", info: null };
    case "PASSWORD_LOGIN_NEEDS_CHANGE":
      return {
        ...state,
        loading: false,
        step: "password-new",
        passwordChangeToken: action.token,
        password: "",
        info: "Bu geçici bir şifre — devam etmeden önce kalıcı bir şifre belirleyin.",
      };
    case "BACK_TO_PHONE":
      return { ...initialState, phone: state.phone };
    default:
      return state;
  }
}

// ----------------------------------------------------------------------------
// Aşağıdaki bölüm SADECE görsel/sunum amaçlıdır — hiçbir akış/state mantığını
// etkilemez. Marka rengi TEK bir turuncu/amber ekosistemi (#FF6B00 / #FF8C00) —
// role göre farklı hue'lara dağılmaz; rol farkı yalnızca rozet METNİYLE ifade
// edilir, bu yüzden tek bir sabit tema yeterlidir (role göre değişen bir
// Record'a gerek yok).
// ----------------------------------------------------------------------------
const ROLE_BADGE_LABEL: Record<RoleId, string> = {
  principal: "Yönetici Portalı",
  teacher: "Öğretmen Portalı",
  student: "Öğrenci Girişi",
  parent: "Veli Girişi",
};

const VISION_BADGES = [
  { icon: Layers, label: "Çoklu Rol Mimarisi" },
  { icon: Zap, label: "Anlık Veri Akışı" },
  { icon: Fingerprint, label: "Kurumsal Güvenlik" },
];

const ACCENT_CHIP = "border-[#FF8C00]/30 bg-[#FF8C00]/10 text-[#FFB066]";
const ACCENT_RING = "focus:border-[#FF8C00] focus:ring-[#FF8C00]/40 focus:shadow-[0_0_24px_-6px_#FF8C00]";
const ACCENT_BUTTON =
  "bg-gradient-to-r from-[#FF6B00] to-[#FF8C00] shadow-[0_8px_30px_-8px_rgba(255,140,0,0.6)] hover:shadow-[0_8px_40px_-6px_rgba(255,140,0,0.85)] hover:from-[#FF7A1A] hover:to-[#FFA324]";
const ACCENT_TEXT = "text-[#FFA347]";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-white placeholder-white/25 outline-none transition-all duration-200 focus:bg-white/[0.08] focus:ring-2";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectRole } = useRole();

  const roleParam = searchParams.get("role");
  const role = VALID_ROLES.includes(roleParam as RoleId) ? (roleParam as RoleId) : null;

  // Geçersiz/eksik ?role= ile buraya gelinemez — akış her zaman rol
  // seçiminden başlar.
  useEffect(() => {
    if (!role) router.replace("/");
  }, [role, router]);

  const [state, dispatch] = useReducer(reducer, initialState);
  // Çift-tıklama koruması: dispatch/loading henüz render'a yansımadan önce
  // gelebilecek ikinci bir isteği senkron olarak keser (yalnızca UI
  // tekrarını önler — rol kontrolü her zaman sunucuda, her istekte tekrar
  // yapılır, bu ref'in rolle hiçbir ilgisi yoktur).
  const inFlightRef = useRef(false);

  if (!role) return null;

  const isLockoutError = state.error ? /kilit|dakika|bekleyin/i.test(state.error) : false;

  function goTo(roleId: RoleId, redirect: string) {
    selectRole(roleId);
    router.replace(redirect);
  }

  async function startLogin(e: FormEvent, intent: Intent = "login") {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (state.phone.trim().length < 10) {
      dispatch({ type: "FAIL", message: "Geçerli bir telefon numarası girin." });
      return;
    }
    inFlightRef.current = true;
    dispatch({ type: "SUBMIT" });
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: state.phone, expectedRole: role, intent }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "FAIL", message: data.error ?? "Bir hata oluştu." });
        return;
      }
      if (data.needsOtp) {
        dispatch({ type: "START_NEEDS_OTP", devOtp: data.devOtp ?? null, intent });
      } else {
        dispatch({ type: "START_NEEDS_PASSWORD" });
      }
    } catch {
      dispatch({ type: "FAIL", message: "İstek sırasında bir hata oluştu." });
    } finally {
      inFlightRef.current = false;
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (state.code.length !== 6) {
      dispatch({ type: "FAIL", message: "6 haneli kodu girin." });
      return;
    }
    inFlightRef.current = true;
    dispatch({ type: "SUBMIT" });
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: state.phone, code: state.code, expectedRole: role, intent: state.intent }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "FAIL", message: data.error ?? "Kod doğrulanamadı." });
        return;
      }
      dispatch({ type: "OTP_VERIFIED", token: data.passwordChangeToken });
    } catch {
      dispatch({ type: "FAIL", message: "İstek sırasında bir hata oluştu." });
    } finally {
      inFlightRef.current = false;
    }
  }

  async function setNewPassword(e: FormEvent) {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (state.password.length < 6) {
      dispatch({ type: "FAIL", message: "Şifre en az 6 karakter olmalıdır." });
      return;
    }
    if (state.password !== state.confirmPassword) {
      dispatch({ type: "FAIL", message: "Şifreler eşleşmiyor." });
      return;
    }
    inFlightRef.current = true;
    dispatch({ type: "SUBMIT" });
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwordChangeToken: state.passwordChangeToken, password: state.password, expectedRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "FAIL", message: data.error ?? "Şifre belirlenemedi." });
        return;
      }
      goTo(data.roleId, data.redirect);
    } catch {
      dispatch({ type: "FAIL", message: "İstek sırasında bir hata oluştu." });
    } finally {
      inFlightRef.current = false;
    }
  }

  async function loginWithPassword(e: FormEvent) {
    e.preventDefault();
    if (inFlightRef.current) return;
    if (!state.password) {
      dispatch({ type: "FAIL", message: "Şifre zorunludur." });
      return;
    }
    inFlightRef.current = true;
    dispatch({ type: "SUBMIT" });
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: state.phone, password: state.password, expectedRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        dispatch({ type: "FAIL", message: data.error ?? "Giriş yapılamadı." });
        return;
      }
      if (data.mustChangePassword) {
        dispatch({ type: "PASSWORD_LOGIN_NEEDS_CHANGE", token: data.passwordChangeToken });
        return;
      }
      goTo(data.roleId, data.redirect);
    } catch {
      dispatch({ type: "FAIL", message: "İstek sırasında bir hata oluştu." });
    } finally {
      inFlightRef.current = false;
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08060B]">
      <AuroraOrbs />
      <div className="pointer-events-none absolute inset-0 opacity-[0.35]" style={AURORA_GRID_STYLE} />

      <div className="relative z-10 flex min-h-screen">
        {/* Sol vitrin paneli — sadece geniş ekranlarda */}
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-white/10 p-12 lg:flex">
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <GlowLogo />
              <span className={cn(spaceGrotesk.className, "text-lg font-semibold text-white")}>Routinix Kampüs</span>
            </div>

            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="mt-16 max-w-md">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-wide", ACCENT_CHIP)}>
                Kampüs Yönetim Cockpit&apos;i
              </span>
              <h2 className={cn(spaceGrotesk.className, "mt-5 text-4xl font-bold leading-[1.15] text-white")}>
                Kurumsal eğitim yönetiminde <span className={ACCENT_TEXT}>yeni nesil</span> standart.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/45">
                Kampüs ekosisteminize hoş geldiniz — yönetici, öğretmen, öğrenci ve veli için tek, güvenli
                kimlik doğrulama altyapısı üzerinden, kendi kapsamına özel bir deneyim.
              </p>
            </motion.div>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3">
            {VISION_BADGES.map((badge, index) => (
              <motion.div
                key={badge.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.15 + index * 0.08 }}
                whileHover={{ y: -3 }}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md transition-all duration-300 hover:border-[#FF8C00]/40 hover:bg-white/[0.06] hover:shadow-[0_0_30px_-10px_#FF8C00]"
              >
                <badge.icon className="h-4 w-4 text-white/50 transition-colors duration-300 group-hover:text-[#FFA347]" />
                <p className="mt-2 text-xs font-medium text-white/60 transition-colors duration-300 group-hover:text-white/85">{badge.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Sağ panel — giriş formu */}
        <div className="flex w-full flex-1 items-center justify-center p-4 sm:p-8 lg:w-1/2">
          <div className="w-full max-w-md">
            {/* Mobilde sol panel gizli olduğundan kompakt logo satırı */}
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <GlowLogo size="h-9 w-9" textSize="text-sm" />
              <span className={cn(spaceGrotesk.className, "text-base font-semibold text-white")}>Routinix Kampüs</span>
            </div>

            <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold", ACCENT_CHIP)}>
              <ShieldCheck className="h-3.5 w-3.5" /> {ROLE_BADGE_LABEL[role]}
            </span>

            <div className="mb-8 mt-4">
              <h1 className={cn(spaceGrotesk.className, "text-3xl font-bold text-white")}>Kampüs&apos;e Giriş</h1>
              <p className="mt-1.5 text-sm text-white/40">{ROLE_LABEL_TR[role]} olarak devam ediyorsunuz.</p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/40 transition hover:text-white/70"
              >
                <ArrowLeft className="h-3 w-3" />
                Farklı bir rolle mi giriş yapacaksınız?
                <span className={cn("font-semibold underline underline-offset-2", ACCENT_TEXT)}>Ana sayfaya dön</span>
              </button>
            </div>

            <div className="relative">
              <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-[#FF6B00]/25 via-[#FF8C00]/10 to-transparent opacity-60 blur-2xl" aria-hidden />
              <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-sm sm:p-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={state.step}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {state.step === "phone" && (
                      <form onSubmit={(e) => startLogin(e, "login")} className="space-y-5">
                        <label className="block">
                          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                            <Phone className="h-3.5 w-3.5" /> Telefon Numarası
                          </span>
                          <input
                            type="tel"
                            inputMode="tel"
                            autoFocus
                            value={state.phone}
                            onChange={(e) => dispatch({ type: "SET_PHONE", value: e.target.value })}
                            placeholder="0555 000 00 00"
                            className={cn(inputClass, ACCENT_RING)}
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={state.loading}
                          className={cn(
                            "group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:shadow-none",
                            ACCENT_BUTTON
                          )}
                        >
                          {state.loading ? (
                            "Kontrol ediliyor…"
                          ) : (
                            <>
                              Devam Et
                              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </>
                          )}
                        </button>
                      </form>
                    )}

                    {state.step === "otp" && (
                      <form onSubmit={verifyOtp} className="space-y-5">
                        <p className="text-center text-xs text-white/40">
                          Telefon: <span className="text-white/70">{state.phone}</span>
                        </p>

                        {state.info && (
                          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-white/40">
                            <KeyRound className="h-3 w-3 shrink-0" /> {state.info}
                          </p>
                        )}

                        {state.devOtp && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className={cn("rounded-xl border p-3 text-center", ACCENT_CHIP)}
                          >
                            <p className="text-[10px] uppercase tracking-wide opacity-70">Demo Kodu</p>
                            <p className="mt-1 text-2xl font-mono font-bold tracking-[0.3em] text-white">{state.devOtp}</p>
                          </motion.div>
                        )}

                        <div>
                          <span className="mb-3 flex items-center justify-center gap-1.5 text-sm font-medium text-white/70">
                            <KeyRound className="h-3.5 w-3.5" /> Doğrulama Kodu
                          </span>
                          <OtpInput
                            value={state.code}
                            onChange={(value) => dispatch({ type: "SET_CODE", value })}
                            autoFocus
                            ringClassName={ACCENT_RING}
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={state.loading}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:shadow-none",
                            ACCENT_BUTTON
                          )}
                        >
                          {state.loading ? "Doğrulanıyor…" : "Doğrula"}
                        </button>

                        <button
                          type="button"
                          onClick={() => dispatch({ type: "BACK_TO_PHONE" })}
                          className="flex w-full items-center justify-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Telefon numarasını değiştir
                        </button>
                      </form>
                    )}

                    {state.step === "password-login" && (
                      <form onSubmit={loginWithPassword} className="space-y-5">
                        <p className="text-center text-xs text-white/40">
                          Telefon: <span className="text-white/70">{state.phone}</span>
                        </p>

                        <label className="block">
                          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-white/70">
                            <Lock className="h-3.5 w-3.5" /> Şifre
                          </span>
                          <input
                            type="password"
                            autoFocus
                            value={state.password}
                            onChange={(e) => dispatch({ type: "SET_PASSWORD", value: e.target.value })}
                            placeholder="••••••••"
                            className={cn(inputClass, ACCENT_RING)}
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={state.loading}
                          className={cn(
                            "group flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:shadow-none",
                            ACCENT_BUTTON
                          )}
                        >
                          {state.loading ? (
                            "Giriş yapılıyor…"
                          ) : (
                            <>
                              Giriş Yap
                              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                            </>
                          )}
                        </button>

                        <div className="flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => dispatch({ type: "BACK_TO_PHONE" })}
                            className="flex items-center gap-1 text-white/40 transition hover:text-white/70"
                          >
                            <ArrowLeft className="h-3 w-3" /> Telefonu değiştir
                          </button>
                          <button type="button" onClick={(e) => startLogin(e as unknown as FormEvent, "reset")} className={cn("font-medium transition hover:opacity-80", ACCENT_TEXT)}>
                            Şifremi unuttum
                          </button>
                        </div>
                      </form>
                    )}

                    {state.step === "password-new" && (
                      <form onSubmit={setNewPassword} className="space-y-5">
                        <div className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                          <span>{state.info ?? "Kalıcı bir şifre belirleyin."}</span>
                        </div>

                        <label className="block">
                          <span className="mb-1.5 block text-sm font-medium text-white/70">Yeni Şifre</span>
                          <input
                            type="password"
                            autoFocus
                            value={state.password}
                            onChange={(e) => dispatch({ type: "SET_PASSWORD", value: e.target.value })}
                            placeholder="En az 6 karakter"
                            className={cn(inputClass, ACCENT_RING)}
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-sm font-medium text-white/70">Şifre (Tekrar)</span>
                          <input
                            type="password"
                            value={state.confirmPassword}
                            onChange={(e) => dispatch({ type: "SET_CONFIRM_PASSWORD", value: e.target.value })}
                            placeholder="Şifreyi tekrar girin"
                            className={cn(inputClass, ACCENT_RING)}
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={state.loading}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:shadow-none",
                            ACCENT_BUTTON
                          )}
                        >
                          {state.loading ? "Kaydediliyor…" : "Şifreyi Belirle"}
                        </button>

                        <button
                          type="button"
                          onClick={() => dispatch({ type: "BACK_TO_PHONE" })}
                          className="flex w-full items-center justify-center gap-1.5 text-sm text-white/40 transition hover:text-white/70"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Baştan başla
                        </button>
                      </form>
                    )}
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence>
                  {state.error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-5 overflow-hidden"
                    >
                      <div
                        className={cn(
                          "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm",
                          isLockoutError ? "border-[#FF8C00]/30 bg-[#FF8C00]/10 text-[#FFB066]" : "border-red-400/30 bg-red-500/10 text-red-200"
                        )}
                      >
                        {isLockoutError ? <Lock className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
                        <span>{state.error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
