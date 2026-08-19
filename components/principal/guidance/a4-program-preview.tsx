"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Printer } from "lucide-react";
import { DAYS_OF_WEEK, INSTITUTION_NAME, type WeeklyProgramEntry } from "@/lib/mock-data";

export function A4ProgramPreview({
  isOpen,
  onClose,
  studentName,
  weekLabel,
  entries,
}: {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  weekLabel: string;
  entries: WeeklyProgramEntry[];
}) {
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
                <p className="text-sm font-semibold text-espresso">Kurumsal A4 Çıktı Önizlemesi</p>
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
                {/* A4 oranı (210:297) sabitlenmiş sayfa alanı — yazdırılırken
                    sadece bu blok görünür (bkz. globals.css .printable-a4) */}
                <div
                  className="printable-a4 relative mx-auto flex flex-col bg-white p-10 text-espresso shadow-lg"
                  style={{ width: "210mm", minHeight: "297mm" }}
                >
                  <div className="mb-6 flex items-center gap-3 border-b-4 border-brand-600 pb-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-espresso text-lg font-bold text-cream">
                      R
                    </span>
                    <div>
                      <p className="text-2xl font-bold uppercase tracking-tight text-espresso">
                        {INSTITUTION_NAME.toUpperCase()}
                      </p>
                      <p className="text-sm font-medium uppercase tracking-[0.15em] text-brand-600">
                        Haftalık Akademik Çalışma Programı
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center justify-between text-sm">
                    <p>
                      <span className="text-espresso-muted">Öğrenci: </span>
                      <span className="font-semibold">{studentName}</span>
                    </p>
                    <p>
                      <span className="text-espresso-muted">Hafta: </span>
                      <span className="font-semibold">{weekLabel}</span>
                    </p>
                  </div>

                  <div className="mb-6 flex-1 overflow-hidden rounded-lg border border-hairline">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-espresso text-cream">
                          <th className="px-2 py-2 text-left font-medium">Gün</th>
                          <th className="px-2 py-2 text-left font-medium">Saat</th>
                          <th className="px-2 py-2 text-left font-medium">Ders</th>
                          <th className="px-2 py-2 text-left font-medium">Konu</th>
                          <th className="px-2 py-2 text-right font-medium">Hedef Soru</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS_OF_WEEK.map((day) => {
                          const dayEntries = entries.filter((entry) => entry.day === day);
                          if (dayEntries.length === 0) {
                            return (
                              <tr key={day} className="border-t border-hairline">
                                <td className="px-2 py-2 font-medium">{day}</td>
                                <td colSpan={4} className="px-2 py-2 text-espresso-muted">
                                  Boş
                                </td>
                              </tr>
                            );
                          }
                          return dayEntries.map((entry, index) => (
                            <tr key={entry.id} className="border-t border-hairline">
                              {index === 0 && (
                                <td className="px-2 py-2 align-top font-medium" rowSpan={dayEntries.length}>
                                  {day}
                                </td>
                              )}
                              <td className="px-2 py-2">{entry.time}</td>
                              <td className="px-2 py-2">{entry.subject}</td>
                              <td className="px-2 py-2">{entry.topic}</td>
                              <td className="px-2 py-2 text-right">{entry.questionTarget}</td>
                            </tr>
                          ));
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mb-8">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-espresso-muted">
                      Rehber Öğretmen Notu
                    </p>
                    <p className="rounded-lg border border-hairline p-3 text-xs text-espresso-muted">
                      Bu program haftalık takibe göre esnetilebilir; her gün için belirtilen hedef soru sayısına
                      ulaşıldığında ilgili konu tamamlanmış sayılır.
                    </p>
                  </div>

                  <div className="mt-auto flex items-end justify-between">
                    <div>
                      <p className="text-xs text-espresso-muted">Rehber Öğretmen</p>
                      <p className="mt-6 w-40 border-t border-espresso/40 pt-1 text-xs">Zehra Rehber</p>
                    </div>
                    <p className="text-[10px] italic text-espresso-muted/60">Powered by Routinix Kampüs</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
