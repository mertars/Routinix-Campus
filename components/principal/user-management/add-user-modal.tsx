"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, UserCog2, ShieldCheck, Send, Loader2 } from "lucide-react";
import { INITIAL_BRANCHES } from "@/lib/mock-data";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { NewUserCredentials } from "./credentials-card-modal";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

const ROLE_TABS: { id: Role; label: string; icon: typeof GraduationCap }[] = [
  { id: "STUDENT", label: "Öğrenci", icon: GraduationCap },
  { id: "TEACHER", label: "Öğretmen", icon: UserCog2 },
  { id: "ADMIN", label: "Yönetici", icon: ShieldCheck },
];

const SUBJECT_OPTIONS = ["Matematik", "Fizik", "Kimya", "Biyoloji", "Türkçe", "Tarih", "Coğrafya", "İngilizce", "LGS Branş", "Rehberlik", "Diğer"];

const AUTHORITY_OPTIONS: { id: string; label: string }[] = [
  { id: "BRANCH_MANAGER", label: "Şube Müdürü" },
  { id: "COORDINATOR", label: "Koordinatör" },
  { id: "SUPER_ADMIN", label: "Genel Müdür" },
];

const inputClass =
  "w-full rounded-lg border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream";

export function AddUserModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: (credentials: NewUserCredentials) => void }) {
  const { showError } = useToast();
  const [role, setRole] = useState<Role>("STUDENT");
  const [submitting, setSubmitting] = useState(false);

  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [branchId, setBranchId] = useState(INITIAL_BRANCHES[0]?.id ?? "");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [healthNote, setHealthNote] = useState("");
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [email, setEmail] = useState("");
  const [advisorBranchId, setAdvisorBranchId] = useState("");
  const [title, setTitle] = useState("");
  const [authorityLevel, setAuthorityLevel] = useState("BRANCH_MANAGER");

  function resetForm() {
    setFullName("");
    setNationalId("");
    setParentName("");
    setParentPhone("");
    setHealthNote("");
    setSubject(SUBJECT_OPTIONS[0]);
    setCustomSubject("");
    setMobilePhone("");
    setEmail("");
    setAdvisorBranchId("");
    setTitle("");
    setAuthorityLevel("BRANCH_MANAGER");
  }

  const isValid =
    fullName.trim().length > 1 &&
    (role === "STUDENT"
      ? nationalId.trim() && branchId
      : role === "TEACHER"
        ? nationalId.trim() && (subject !== "Diğer" || customSubject.trim()) && mobilePhone.trim()
        : title.trim() && mobilePhone.trim() && email.trim());

  async function handleSubmit() {
    if (!isValid) return;
    setSubmitting(true);
    try {
      const body =
        role === "STUDENT"
          ? { role, fullName, nationalId, branchId, parentName, parentPhone, healthNote }
          : role === "TEACHER"
            ? { role, fullName, nationalId, subject: subject === "Diğer" ? customSubject : subject, mobilePhone, email, advisorBranchId: advisorBranchId || undefined }
            : { role, fullName, title, mobilePhone, email, authorityLevel };

      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kullanıcı oluşturulamadı.");

      const phone = role === "STUDENT" ? parentPhone : mobilePhone;
      onCreated({
        name: fullName.trim(),
        username: data.username,
        password: data.password,
        phone: phone.trim() || undefined,
        institutionalCode: data.institutionalCode,
      });
      resetForm();
      onClose();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kullanıcı oluşturulamadı.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Kullanıcı Ekle">
      <div className="mb-4 flex gap-1.5 rounded-xl bg-cream-card p-1 dark:bg-white/5">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRole(tab.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition",
              role === tab.id ? "bg-espresso text-cream dark:bg-brand-600" : "text-espresso-muted dark:text-cream/40"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" className={cn(inputClass, "mb-3")} />

      <AnimatePresence mode="wait">
        {role === "STUDENT" && (
          <motion.div key="student" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="T.C. Kimlik No" className={inputClass} />
            <p className="-mt-1.5 text-[10px] text-espresso-muted dark:text-cream/40">
              Öğrenci No (kurumsal kod) kaydedince otomatik atanır — örn. &quot;2026-1001&quot;.
            </p>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={inputClass}>
              {INITIAL_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input value={parentName} onChange={(e) => setParentName(e.target.value)} placeholder="Veli Ad Soyad" className={inputClass} />
              <input value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} placeholder="Veli Telefonu" className={inputClass} />
            </div>
            <textarea value={healthNote} onChange={(e) => setHealthNote(e.target.value)} placeholder="Tıbbi / özel not (isteğe bağlı)" rows={2} className={inputClass} />
          </motion.div>
        )}

        {role === "TEACHER" && (
          <motion.div key="teacher" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="T.C. Kimlik No" className={inputClass} />
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
              {INITIAL_BRANCHES.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </motion.div>
        )}

        {role === "ADMIN" && (
          <motion.div key="admin" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Unvan (örn. Kurum Müdür Yardımcısı)" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input value={mobilePhone} onChange={(e) => setMobilePhone(e.target.value)} placeholder="GSM" className={inputClass} />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-posta" className={inputClass} />
            </div>
            <div className="flex gap-1.5 rounded-lg border border-hairline p-1 dark:border-white/10">
              {AUTHORITY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAuthorityLevel(option.id)}
                  className={cn(
                    "flex-1 rounded-md py-1.5 text-[11px] font-medium transition",
                    authorityLevel === option.id ? "bg-brand-600 text-white" : "text-espresso-muted dark:text-cream/40"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-espresso text-sm font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? "Oluşturuluyor..." : "Kullanıcıyı Oluştur"}
      </button>
    </Modal>
  );
}
