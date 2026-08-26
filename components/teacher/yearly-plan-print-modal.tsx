"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Printer } from "lucide-react";
import { useInstitutionName } from "@/lib/institution-scope";

export function YearlyPlanPrintModal({
  isOpen,
  onClose,
  teacherName,
  subject,
  rows,
}: {
  isOpen: boolean;
  onClose: () => void;
  teacherName: string;
  subject: string;
  rows: { weekLabel: string; subtopicName: string; notes: string }[];
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
            className="print:hidden fixed inset-0 z-[60] bg-espresso/50 backdrop-blur-sm"
          />
          <div className="print:hidden fixed inset-4 z-[70] flex items-center justify-center sm:inset-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-hairline px-5 py-3">
                <p className="text-sm font-semibold text-espresso">Yıllık Plan Önizlemesi</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel"
                  >
                    <Printer className="h-3.5 w-3.5" /> Yazdır
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
                <div
                  className="printable-a4 relative mx-auto flex flex-col bg-white p-10 text-espresso shadow-lg"
                  style={{ width: "210mm", minHeight: "297mm" }}
                >
                  <div className="mb-6 flex items-center gap-3 border-b-4 border-brand-600 pb-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-espresso text-lg font-bold text-cream">
                      R
                    </span>
                    <div>
                      <p className="text-2xl font-bold uppercase tracking-tight text-espresso">{institutionName.toUpperCase()}</p>
                      <p className="text-sm font-medium uppercase tracking-[0.15em] text-brand-600">Özelleştirilmiş Yıllık Plan</p>
                    </div>
                  </div>
                  <div className="mb-6 flex items-center justify-between text-sm">
                    <p><span className="text-espresso-muted">Öğretmen: </span><span className="font-semibold">{teacherName}</span></p>
                    <p><span className="text-espresso-muted">Branş: </span><span className="font-semibold">{subject}</span></p>
                  </div>
                  <div className="flex-1 overflow-hidden rounded-lg border border-hairline">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-espresso text-cream">
                          <th className="px-2 py-2 text-left font-medium">Hafta</th>
                          <th className="px-2 py-2 text-left font-medium">Kazanım / Alt Konu</th>
                          <th className="px-2 py-2 text-left font-medium">Not</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={index} className="border-t border-hairline">
                            <td className="px-2 py-1.5 font-medium">{row.weekLabel}</td>
                            <td className="px-2 py-1.5">{row.subtopicName}</td>
                            <td className="px-2 py-1.5 text-espresso-muted">{row.notes || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-8 text-right text-[10px] italic text-espresso-muted/60">Powered by Routinix Kampüs</p>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
