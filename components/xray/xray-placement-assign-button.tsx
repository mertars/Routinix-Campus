"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { useToast } from "@/lib/toast-context";

// Faz Q — yöneticinin tek bir öğrenciye "Seviye Belirleme Sınavı" ataması.
// Diğer atama panellerinin (XrayAssignmentSection/XrayPracticeAssignment
// Section) yanında, sağ sütunun EN ÜSTÜNDE — kullanıcı talebi: "dershaneye
// her gelen öğrenciye" bu testin verilmesi, yani ilk/öncelikli eylem bu.
export function XrayPlacementAssignButton({ studentId, studentName, subject }: { studentId: string; studentName: string; subject: string }) {
  const { showError, showToast } = useToast();
  const [assigning, setAssigning] = useState(false);

  async function assign() {
    setAssigning(true);
    try {
      const res = await fetch("/api/xray/placement-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: { type: "student", studentId }, subject }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Atanamadı.");
      if (data.created > 0) showToast("success", `${studentName} için seviye belirleme sınavı atandı.`);
      else showError("Bu sınıf seviyesi için soru havuzu boş görünüyor.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Atanamadı.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4 dark:border-sky-400/20 dark:bg-sky-400/5"
    >
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-espresso dark:text-cream">
        <ClipboardCheck className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" /> Seviye Belirleme Sınavı
      </h3>
      <p className="mb-3 text-[11px] leading-relaxed text-espresso-muted dark:text-cream/40">
        Öğrencinin sınıf seviyesine göre kapsamlı bir ilk tanı testi atar (12. sınıf/mezunlarda 9-12. sınıf müfredatının tamamı) — tüm kazanım analizini tek seferde doldurur.
      </p>
      <button
        onClick={assign}
        disabled={assigning}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
      >
        {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
        Sınavı Ata
      </button>
    </motion.div>
  );
}
