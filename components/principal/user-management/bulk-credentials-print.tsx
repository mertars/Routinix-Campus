"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Printer } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";

export type PrintableCredential = { fullName: string; username: string; password: string; phone?: string; institutionalCode?: string };

export function BulkCredentialsPrint({
  isOpen,
  onClose,
  role,
  credentials,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: "STUDENT" | "TEACHER";
  credentials: PrintableCredential[];
}) {
  const institutionName = useInstitutionName();
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="print:hidden fixed inset-0 z-[80] bg-espresso/50 backdrop-blur-sm"
          />
          <div className="print:hidden fixed inset-4 z-[90] flex items-center justify-center sm:inset-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
                <p className="text-sm font-semibold text-espresso">Toplu Giriş Bilgileri Önizlemesi</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel"
                  >
                    <Printer className="h-3.5 w-3.5" /> Yazdır / PDF
                  </button>
                  <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-espresso-muted transition hover:bg-cream-card"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto bg-espresso/5 p-6">
                <div className="printable-a4 relative mx-auto flex flex-col bg-white p-10 text-espresso shadow-lg" style={{ width: "210mm", minHeight: "297mm" }}>
                  <div className="mb-6 flex items-center justify-between border-b border-hairline pb-4">
                    <div>
                      <p className="text-lg font-bold">{institutionName}</p>
                      <p className="text-xs text-espresso-muted">Toplu Giriş Bilgileri Listesi — {role === "STUDENT" ? "Öğrenci" : "Öğretmen"}</p>
                    </div>
                    <p className="text-xs text-espresso-muted">{new Date().toLocaleDateString("tr-TR")}</p>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-espresso/20 text-left">
                        <th className="py-2 pr-2 font-semibold">#</th>
                        <th className="py-2 pr-2 font-semibold">Ad Soyad</th>
                        <th className="py-2 pr-2 font-semibold">Telefon (Giriş)</th>
                        <th className="py-2 pr-2 font-semibold">Geçici Şifre</th>
                        <th className="py-2 pr-2 font-semibold">Kayıt No</th>
                        {role === "TEACHER" && <th className="py-2 font-semibold">Kurumsal Kod</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {credentials.map((c, index) => (
                        <tr key={`${c.username}-${index}`} className="border-b border-hairline">
                          <td className="py-1.5 pr-2 text-espresso-muted">{index + 1}</td>
                          <td className="py-1.5 pr-2">{c.fullName}</td>
                          <td className="py-1.5 pr-2 font-mono">{c.phone ?? "—"}</td>
                          <td className="py-1.5 pr-2 font-mono font-semibold">{c.password}</td>
                          <td className="py-1.5 pr-2 font-mono">{c.username}</td>
                          {role === "TEACHER" && <td className="py-1.5 font-mono">{c.institutionalCode ?? "—"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="mt-6 text-[10px] text-espresso-muted">
                    Giriş sayfasında sadece Telefon ve Geçici Şifre kullanılır (Kayıt No kurum kaydı içindir, girişte istenmez). Bu şifreler geçicidir
                    ve bir kez gösterilir — kullanıcıların ilk girişte değiştirmesi zorunludur. Bu belgeyi güvenli şekilde saklayın.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
