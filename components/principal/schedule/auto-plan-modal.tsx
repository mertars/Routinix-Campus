"use client";

import { useState } from "react";
import { AlertTriangle, Check, Info, Loader2, Sparkles, UserX } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

// OTOMATİK DERS PROGRAMI — önizleme + sorumlu ders çıktısı.
//
// ⚠️ NEDEN ÖNİZLEMELİ (Mert, 2026-09-18): "yaptıktan sonra her sınıfı hangi
// derslerden sorumlu tuttun bana çıktısını ver, yanlış varsa ben
// düzeltirim." Yani asıl çıktı program değil, SORUMLULUK TABLOSU — plan
// ondan türüyor. Yönetici tabloyu onaylamadan hiçbir şey kaydedilmiyor.
//
// Ekran üç şeyi birlikte söyler: (1) hangi sınıf hangi derslerden sorumlu
// ve kaç saat aldı, (2) alanı girilmemiş sınıflar, (3) öğretmeni olmadığı
// için BOŞ kalan dersler. Üçü de yöneticinin düzeltmesi gereken şeyler.

type BranchReport = {
  branchId: string;
  branchName: string;
  grade: number | null;
  trackLabel: string;
  trackMissing: boolean;
  responsible: string[];
  assigned: Record<string, number>;
  missingTeacher: string[];
  scarceSubjects: string[];
  emptySlots: number;
};

type PlanResponse = {
  assignments: { branchId: string; day: string; slot: string; subject: string; teacherName: string }[];
  branches: BranchReport[];
  unstaffedSubjects: string[];
  totalSlots: number;
  filledSlots: number;
  willDelete: number;
  keepExisting: boolean;
  applied: boolean;
  created?: number;
  deleted?: number;
};

export function AutoPlanModal({
  isOpen,
  onClose,
  onApplied,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [keepExisting, setKeepExisting] = useState(true);
  const [preview, setPreview] = useState<PlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function run(dryRun: boolean) {
    dryRun ? setLoading(true) : setApplying(true);
    try {
      const res = await fetch("/api/admin/schedule-auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, keepExisting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Plan oluşturulamadı.");
      setPreview(data);
      if (!dryRun) {
        showSuccess(`${data.created} ders programa yazıldı.`);
        onApplied();
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Plan oluşturulamadı.");
    } finally {
      setLoading(false);
      setApplying(false);
    }
  }

  const missingTrack = (preview?.branches ?? []).filter((b) => b.trackMissing);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Otomatik Ders Programı" variant="center" widthClassName="max-w-4xl">
      <div className="space-y-3.5">
        <div className="flex gap-2.5 rounded-2xl border border-brand-500/25 bg-brand-50/60 p-3.5 dark:border-brand-500/20 dark:bg-brand-600/10">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p className="text-[11.5px] leading-relaxed text-espresso dark:text-cream/70">
            Plan üç sert kurala uyar: bir sınıfa <strong>yalnızca sorumlu olduğu ders</strong> yazılır (7. sınıfa Kimya,
            sayısal 12&apos;ye Edebiyat yazılmaz), dersi veren öğretmenin <strong>branşı tutmak zorundadır</strong> ve
            bir öğretmen <strong>aynı saatte iki şubede</strong> olamaz. Müsait olmadığı saatler de atlanır. Uygun
            öğretmen yoksa hücre <strong>boş bırakılır</strong> — yanlış branşla doldurulmaz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-xl border border-hairline px-3 text-[12.5px] text-espresso dark:border-white/10 dark:text-cream">
            <input type="checkbox" checked={keepExisting} onChange={(e) => setKeepExisting(e.target.checked)} />
            Mevcut programı koru (sadece boş saatleri doldur)
          </label>
          <button
            onClick={() => run(true)}
            disabled={loading || applying}
            className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-espresso px-3.5 text-[12.5px] font-semibold text-cream transition hover:bg-caramel disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Planı Oluştur (önizleme)
          </button>
          {preview && !preview.applied && (
            <button
              onClick={() => run(false)}
              disabled={applying || loading}
              className="ml-auto flex min-h-[38px] items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Uygula ({preview.assignments.length} ders)
            </button>
          )}
        </div>

        {!keepExisting && preview && preview.willDelete > 0 && (
          <p className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-2 text-[11.5px] font-medium text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Uygula&apos;ya basarsanız mevcut {preview.willDelete} ders SİLİNİP yeniden yazılır. (Silinenler çöp
            kutusuna düşer.)
          </p>
        )}

        {preview && (
          <>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-xl border border-hairline bg-white p-2.5 dark:border-white/10 dark:bg-midnight-card/50">
                <p className="text-lg font-bold tabular-nums text-espresso dark:text-cream">{preview.assignments.length}</p>
                <p className="text-[10.5px] text-espresso-muted dark:text-cream/45">Önerilen ders</p>
              </div>
              <div className="rounded-xl border border-hairline bg-white p-2.5 dark:border-white/10 dark:bg-midnight-card/50">
                <p className="text-lg font-bold tabular-nums text-espresso dark:text-cream">
                  {preview.filledSlots}/{preview.totalSlots}
                </p>
                <p className="text-[10.5px] text-espresso-muted dark:text-cream/45">Dolu hücre</p>
              </div>
              <div
                className={cn(
                  "rounded-xl border p-2.5",
                  missingTrack.length > 0
                    ? "border-amber-500/30 bg-amber-50 dark:bg-amber-500/10"
                    : "border-hairline bg-white dark:border-white/10 dark:bg-midnight-card/50"
                )}
              >
                <p className="text-lg font-bold tabular-nums text-espresso dark:text-cream">{missingTrack.length}</p>
                <p className="text-[10.5px] text-espresso-muted dark:text-cream/45">Alanı girilmemiş sınıf</p>
              </div>
            </div>

            {missingTrack.length > 0 && (
              <p className="rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2 text-[11.5px] leading-snug text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                <strong>{missingTrack.map((b) => b.branchName).join(", ")}</strong> — 11. sınıf ve üzeri olduğu hâlde
                alanı (sayısal / eşit ağırlık / sözel) girilmemiş. Bu sınıflara <strong>yalnızca TYT dersleri</strong>{" "}
                yazıldı; AYT derslerini alabilmeleri için şube alanını girin.
              </p>
            )}

            {preview.unstaffedSubjects.length > 0 && (
              <p className="flex items-start gap-1.5 rounded-xl border border-rose-500/25 bg-rose-50 px-3 py-2 text-[11.5px] leading-snug text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                <UserX className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                <span>
                  Bu derslerin öğretmeni yok, o saatler boş kaldı:{" "}
                  <strong>{preview.unstaffedSubjects.join(", ")}</strong>
                </span>
              </p>
            )}

            {/* ⚠️ MERT'İN İSTEDİĞİ ÇIKTI: hangi sınıf hangi derslerden sorumlu. */}
            <div className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
              <h4 className="text-[13px] font-bold text-espresso dark:text-cream">Hangi sınıf hangi derslerden sorumlu</h4>
              <p className="mb-2.5 mt-0.5 text-[11px] text-espresso-muted dark:text-cream/40">
                Plan bu tablodan türetildi. Yanlış gördüğünüz yeri şube alanını düzelterek değiştirebilirsiniz.{" "}
                <span className="rounded bg-emerald-100 px-1 dark:bg-emerald-500/15">yeşil</span> = atandı,{" "}
                <span className="rounded bg-amber-100 px-1 dark:bg-amber-500/15">amber</span> = öğretmen dolu, saat
                yetmedi, <span className="rounded bg-rose-100 px-1 line-through dark:bg-rose-500/15">kırmızı</span> =
                branş öğretmeni yok.
              </p>
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full min-w-[620px] text-left">
                  <thead className="sticky top-0 bg-white dark:bg-midnight-card">
                    <tr className="border-b border-hairline text-[10.5px] uppercase tracking-wide text-espresso-muted dark:border-white/10 dark:text-cream/40">
                      <th className="pb-1.5 font-semibold">Şube</th>
                      <th className="pb-1.5 font-semibold">Alan</th>
                      <th className="pb-1.5 font-semibold">Sorumlu dersler (atanan saat)</th>
                      <th className="pb-1.5 text-right font-semibold">Boş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.branches.map((b) => (
                      <tr key={b.branchId} className="border-b border-hairline/60 last:border-0 dark:border-white/5">
                        <td className="py-2 pr-2 align-top text-[12px] font-medium text-espresso dark:text-cream">
                          {b.branchName}
                          <span className="ml-1 text-[10px] font-normal text-espresso-muted dark:text-cream/35">
                            {b.grade}. sınıf
                          </span>
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              b.trackMissing
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                : "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/50"
                            )}
                          >
                            {b.trackLabel}
                          </span>
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <div className="flex flex-wrap gap-1">
                            {b.responsible.map((s) => {
                              const hours = b.assigned[s] ?? 0;
                              const noTeacher = b.missingTeacher.includes(s);
                              // ⚠️ ÜÇ AYRI DURUM, ÜÇ AYRI RENK: öğretmeni yok
                              // (kırmızı, üstü çizili) / öğretmeni var ama saati
                              // yetmedi (amber) / atandı (yeşil). İkisini aynı
                              // göstermek "öğretmen al" ile "saat düzenle"yi
                              // karıştırmak olurdu.
                              const scarce = !noTeacher && b.scarceSubjects.includes(s);
                              return (
                                <span
                                  key={s}
                                  title={
                                    noTeacher
                                      ? "Bu dersin branş öğretmeni yok"
                                      : scarce
                                        ? `${hours} saat atandı — öğretmen dolu olduğu için hedefin altında`
                                        : `${hours} saat atandı`
                                  }
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10.5px] tabular-nums",
                                    noTeacher
                                      ? "bg-rose-100 text-rose-700 line-through dark:bg-rose-500/15 dark:text-rose-300"
                                      : scarce
                                        ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                        : hours > 0
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                                          : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/40"
                                  )}
                                >
                                  {s}
                                  {hours > 0 ? ` ${hours}` : ""}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-2 text-right align-top text-[12px] tabular-nums text-espresso-muted dark:text-cream/45">
                          {b.emptySlots}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
