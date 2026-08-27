"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Save, Loader2, KeyRound } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { NewUserCredentials } from "./credentials-card-modal";

type BranchOption = { id: string; name: string };
export type EditTarget = { id: string; role: "STUDENT" | "TEACHER"; name: string } | null;

const SUBJECT_OPTIONS = ["Matematik", "Fizik", "Kimya", "Biyoloji", "Türkçe", "Tarih", "Coğrafya", "İngilizce", "LGS Branş", "Rehberlik", "Diğer"];

const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";

// Kimlik bilgilerine (T.C. No, şifre, öğrenci no/kurumsal kod) BİLEREK
// dokunmaz — sadece AddUserModal'daki oluşturma formunun temel/iletişim
// alanlarının düzenlenebilir bir alt kümesi (bkz. lib/server/admin/update-user.ts).
// Ayrı bir bileşen olarak tutuldu: AddUserModal'a "edit mode" eklemek, rol
// sekmesi geçişi/veli alanları/kimlik alanları gibi oluşturmaya özgü çoğu
// alanın düzenlemede HİÇ görünmemesi gerektiği için oradaki formu daha
// karmaşık hale getirirdi.
export function EditUserModal({
  target,
  onClose,
  onUpdated,
  onPasswordReset,
  branches,
  apiBase = "/api/admin",
}: {
  target: EditTarget;
  onClose: () => void;
  onUpdated: () => void;
  // Yeni geçici şifre üretildiğinde tetiklenir — üst bileşen bunu zaten
  // sahip olduğu CredentialsCardModal state'ine (bkz. add-user-modal.tsx'in
  // onCreated'ı) yönlendirir; burada AYRI bir "Giriş Kartı" modal örneği
  // AÇILMAZ, tekli oluşturmayla tamamen aynı ekran yeniden kullanılır.
  onPasswordReset: (credentials: NewUserCredentials) => void;
  branches: BranchOption[];
  // bkz. add-branch-modal.tsx'teki aynı not.
  apiBase?: string;
}) {
  const { showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const [fullName, setFullName] = useState("");
  const [branchId, setBranchId] = useState("");
  const [phone, setPhone] = useState("");
  const [healthNote, setHealthNote] = useState("");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [email, setEmail] = useState("");
  const [advisorBranchId, setAdvisorBranchId] = useState("");

  useEffect(() => {
    setConfirmingReset(false);
    if (!target) return;
    setLoading(true);
    fetch(`${apiBase}/users/${target.id}?role=${target.role}`)
      .then((res) => res.json())
      .then((data) => {
        if (target.role === "STUDENT") {
          const s = data.student;
          setFullName(`${s.firstName} ${s.lastName}`);
          setBranchId(s.branchId);
          setPhone(s.phone ?? "");
          setHealthNote(s.healthNote ?? "");
        } else {
          const t = data.teacher;
          setFullName(`${t.firstName} ${t.lastName}`);
          if (SUBJECT_OPTIONS.includes(t.subject)) {
            setSubject(t.subject);
            setCustomSubject("");
          } else {
            setSubject("Diğer");
            setCustomSubject(t.subject);
          }
          setMobilePhone(t.mobilePhone ?? "");
          setEmail(t.institutionalEmail ?? "");
          setAdvisorBranchId(t.advisorBranchId ?? "");
        }
      })
      .catch(() => showError("Kayıt yüklenemedi."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const isValid =
    fullName.trim().length > 1 &&
    (target?.role === "STUDENT" ? branchId && phone.trim() : (subject !== "Diğer" || customSubject.trim()) && mobilePhone.trim());

  async function handleSubmit() {
    if (!target || !isValid) return;
    setSubmitting(true);
    try {
      const body =
        target.role === "STUDENT"
          ? { role: "STUDENT", fullName, branchId, phone, healthNote }
          : { role: "TEACHER", fullName, subject: subject === "Diğer" ? customSubject : subject, mobilePhone, email, advisorBranchId: advisorBranchId || undefined };

      const res = await fetch(`${apiBase}/users/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Güncellenemedi.");
      onUpdated();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Güncellenemedi.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!target) return;
    setResetting(true);
    try {
      const res = await fetch(`${apiBase}/users/${target.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: target.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Şifre sıfırlanamadı.");
      onPasswordReset(data.credentials);
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Şifre sıfırlanamadı.");
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  }

  return (
    <Modal isOpen={!!target} onClose={onClose} title={target ? `${target.name} — Düzenle` : "Düzenle"}>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" className={cn(inputClass, "mb-3")} />

          <AnimatePresence mode="wait">
            {target?.role === "STUDENT" ? (
              <motion.div key="student" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
                <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Öğrenci Telefonu (giriş için)" className={inputClass} />
                <textarea value={healthNote} onChange={(e) => setHealthNote(e.target.value)} placeholder="Tıbbi / özel not (isteğe bağlı)" rows={2} className={inputClass} />
              </motion.div>
            ) : (
              <motion.div key="teacher" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {SUBJECT_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSubject(option)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                        subject === option ? "bg-espresso text-cream dark:bg-brand-600" : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {subject === "Diğer" && <input value={customSubject} onChange={(e) => setCustomSubject(e.target.value)} placeholder="Branş adı" className={inputClass} />}
                <div className="grid grid-cols-2 gap-2">
                  <input value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} placeholder="GSM" className={inputClass} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta (isteğe bağlı)" className={inputClass} />
                </div>
                <select value={advisorBranchId} onChange={(e) => setAdvisorBranchId(e.target.value)} className={inputClass}>
                  <option value="">Danışman Sınıf Ataması Yok</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? "Kaydediliyor..." : "Kaydet"}
          </button>

          <div className="mt-3 border-t border-hairline pt-3 dark:border-white/10">
            <AnimatePresence mode="wait">
              {confirmingReset ? (
                <motion.div key="confirm" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
                  <p className="text-[11px] text-espresso-muted dark:text-cream/40">
                    Mevcut geçici/kalıcı şifre geçersiz olur, yeni bir geçici şifre üretilir — bu kişiye tekrar iletmen gerekir.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmingReset(false)}
                      className="flex-1 rounded-xl border border-hairline py-2 text-xs font-medium text-espresso-muted transition hover:bg-cream-card dark:border-white/10 dark:text-cream/40 dark:hover:bg-white/5"
                    >
                      Vazgeç
                    </button>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetting}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-red-600 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                      {resetting ? "Sıfırlanıyor..." : "Evet, Sıfırla"}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="trigger"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => setConfirmingReset(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium text-espresso-muted transition hover:text-red-600 dark:text-cream/40 dark:hover:text-red-400"
                >
                  <KeyRound className="h-3.5 w-3.5" /> Şifreyi Sıfırla (yeni geçici şifre üret)
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </Modal>
  );
}
