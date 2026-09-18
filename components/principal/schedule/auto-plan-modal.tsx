"use client";

import { useState } from "react";
import { AlertTriangle, Check, Info, Loader2, Sparkles, UserX } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { RULE_CATALOG, type PlannerRules, type RuleId } from "@/lib/server/schedule/planner-rules";
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

type RuleCompliance = { ruleId: string; satisfied: number; total: number; detail?: string };

type PlanResponse = {
  compliance: RuleCompliance[];
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


const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"] as const;

/** Öğretmen + gün seçimi — "bu hoca şu gün çalışmıyor". */
function TeacherDayOffEditor({
  teachers,
  value,
  onChange,
}: {
  teachers: { id: string; name: string }[];
  value: { teacherId: string; days: string[] }[];
  onChange: (v: { teacherId: string; days: string[] }[]) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const daysOf = (id: string) => value.find((v) => v.teacherId === id)?.days ?? [];

  function toggleDay(day: string) {
    if (!teacherId) return;
    const current = daysOf(teacherId);
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    const rest = value.filter((v) => v.teacherId !== teacherId);
    onChange(next.length > 0 ? [...rest, { teacherId, days: next }] : rest);
  }

  return (
    <div className="mt-2 space-y-1.5 border-t border-hairline pt-2 dark:border-white/10">
      <select
        value={teacherId}
        onChange={(e) => setTeacherId(e.target.value)}
        className="w-full rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
      >
        <option value="">Öğretmen seçin…</option>
        {teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      {teacherId && (
        <div className="flex flex-wrap gap-1">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleDay(day)}
              className={cn(
                "rounded-full px-2 py-1 text-[11px] font-medium transition",
                daysOf(teacherId).includes(day)
                  ? "bg-rose-600 text-white"
                  : "bg-cream-card text-espresso-muted dark:bg-white/5 dark:text-cream/45"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <p className="text-[10.5px] text-espresso-muted dark:text-cream/40">
          {value
            .map((v) => `${teachers.find((t) => t.id === v.teacherId)?.name ?? "?"}: ${v.days.join(", ")}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

/** Öğretmen–şube eşleşmesi (sabitle / yasakla). */
function TeacherBranchEditor({
  teachers,
  branches,
  value,
  onChange,
}: {
  teachers: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  value: { teacherId: string; branchId: string }[];
  onChange: (v: { teacherId: string; branchId: string }[]) => void;
}) {
  const [teacherId, setTeacherId] = useState("");
  const [branchId, setBranchId] = useState("");
  return (
    <div className="mt-2 space-y-1.5 border-t border-hairline pt-2 dark:border-white/10">
      <div className="flex flex-wrap gap-1.5">
        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          <option value="">Öğretmen…</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          <option value="">Şube…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!teacherId || !branchId}
          onClick={() => {
            if (value.some((v) => v.teacherId === teacherId && v.branchId === branchId)) return;
            onChange([...value, { teacherId, branchId }]);
          }}
          className="rounded-lg bg-espresso px-2.5 py-1.5 text-[11px] font-semibold text-cream disabled:opacity-40 dark:bg-brand-600"
        >
          Ekle
        </button>
      </div>
      {value.map((v, i) => (
        <span
          key={`${v.teacherId}-${v.branchId}`}
          className="mr-1 inline-flex items-center gap-1 rounded-full bg-cream-card px-2 py-0.5 text-[10.5px] dark:bg-white/5"
        >
          {teachers.find((t) => t.id === v.teacherId)?.name} → {branches.find((b) => b.id === v.branchId)?.name}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-rose-600">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/** Şubeye özel ders ağırlığı. */
function EmphasisEditor({
  branches,
  value,
  onChange,
}: {
  branches: { id: string; name: string }[];
  value: { branchId: string; subject: string; factor: number }[];
  onChange: (v: { branchId: string; subject: string; factor: number }[]) => void;
}) {
  const [branchId, setBranchId] = useState("");
  const [subject, setSubject] = useState("");
  const [factor, setFactor] = useState(2);
  return (
    <div className="mt-2 space-y-1.5 border-t border-hairline pt-2 dark:border-white/10">
      <div className="flex flex-wrap gap-1.5">
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
        >
          <option value="">Şube…</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Ders (örn. Matematik)"
          className="min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <input
          type="number"
          min={0.5}
          max={4}
          step={0.5}
          value={factor}
          onChange={(e) => setFactor(Number(e.target.value))}
          className="w-16 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
        <button
          type="button"
          disabled={!branchId || !subject.trim()}
          onClick={() => onChange([...value, { branchId, subject: subject.trim(), factor }])}
          className="rounded-lg bg-espresso px-2.5 py-1.5 text-[11px] font-semibold text-cream disabled:opacity-40 dark:bg-brand-600"
        >
          Ekle
        </button>
      </div>
      {value.map((v, i) => (
        <span
          key={`${v.branchId}-${v.subject}`}
          className="mr-1 inline-flex items-center gap-1 rounded-full bg-cream-card px-2 py-0.5 text-[10.5px] dark:bg-white/5"
        >
          {branches.find((b) => b.id === v.branchId)?.name}: {v.subject} ×{v.factor}
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-rose-600">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function AutoPlanModal({
  isOpen,
  onClose,
  onApplied,
  branches,
  teachers,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => void;
  branches: { id: string; name: string }[];
  teachers: { id: string; name: string }[];
}) {
  const { showError, showSuccess } = useToast();
  const [keepExisting, setKeepExisting] = useState(true);
  const [preview, setPreview] = useState<PlanResponse | null>(null);
  // Seçilen kurallar — hepsi opsiyonel (bkz. planner-rules.ts).
  const [rules, setRules] = useState<PlannerRules>({});
  const [onlyBranchId, setOnlyBranchId] = useState("");
  const [showRules, setShowRules] = useState(true);

  const toggleRule = (id: RuleId, on: boolean) =>
    setRules((prev) => {
      const next = { ...prev };
      if (!on) {
        delete next[id];
        return next;
      }
      const meta = RULE_CATALOG.find((r) => r.id === id);
      if (meta?.kind === "toggle") return { ...next, [id]: true };
      if (meta?.kind === "number") return { ...next, [id]: meta.defaultValue ?? 2 };
      return { ...next, [id]: [] };
    });
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  async function run(dryRun: boolean) {
    dryRun ? setLoading(true) : setApplying(true);
    try {
      const res = await fetch("/api/admin/schedule-auto-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun, keepExisting, rules, branchId: onlyBranchId || undefined }),
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

        {/* ⚠️ KURAL PANELİ (Mert: "otomatik hazırlamadan önce kurallar
            koyabilsin"). Kurallar OPSİYONEL: hiçbiri seçilmezse plan
            eskisi gibi çalışır. Sert kısıtlar rozetle ayrılır — sağlanamazsa
            hücre boş kalır, tercihler ise "elinden geldiğince" uygulanır. */}
        <div className="rounded-2xl border border-hairline bg-white p-3.5 dark:border-white/10 dark:bg-midnight-card/50">
          <button
            onClick={() => setShowRules((v) => !v)}
            className="mb-2 flex w-full items-center justify-between text-left"
          >
            <span className="text-[13px] font-bold text-espresso dark:text-cream">
              Kurallar{" "}
              <span className="font-normal text-espresso-muted dark:text-cream/40">
                ({Object.keys(rules).length} seçili · isteğe bağlı)
              </span>
            </span>
            <span className="text-[11px] text-brand-600">{showRules ? "gizle" : "göster"}</span>
          </button>

          {showRules && (
            <div className="space-y-1.5">
              {RULE_CATALOG.map((rule) => {
                const active = rules[rule.id] !== undefined;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "rounded-xl border px-3 py-2 transition",
                      active
                        ? "border-brand-500/50 bg-brand-50/60 dark:border-brand-500/30 dark:bg-brand-600/10"
                        : "border-hairline dark:border-white/10"
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => toggleRule(rule.id, e.target.checked)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12.5px] font-medium text-espresso dark:text-cream">{rule.label}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase",
                              rule.hard
                                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                                : "bg-cream-card text-espresso-muted dark:bg-white/10 dark:text-cream/45"
                            )}
                          >
                            {rule.hard ? "kesin" : "tercih"}
                          </span>
                        </span>
                        <span className="block text-[10.5px] leading-snug text-espresso-muted dark:text-cream/40">
                          {rule.description}
                        </span>
                      </span>
                    </label>

                    {active && rule.kind === "number" && (
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={Number(rules[rule.id] ?? rule.defaultValue ?? 2)}
                        onChange={(e) => setRules((p) => ({ ...p, [rule.id]: Number(e.target.value) }))}
                        className="mt-1.5 w-24 rounded-lg border border-hairline bg-white px-2 py-1 text-[12px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
                      />
                    )}

                    {active && rule.id === "teacherDaysOff" && (
                      <TeacherDayOffEditor
                        teachers={teachers}
                        value={rules.teacherDaysOff ?? []}
                        onChange={(v) => setRules((p) => ({ ...p, teacherDaysOff: v }))}
                      />
                    )}
                    {active && (rule.id === "pinTeacherToBranch" || rule.id === "banTeacherFromBranch") && (
                      <TeacherBranchEditor
                        teachers={teachers}
                        branches={branches}
                        value={(rules[rule.id] as { teacherId: string; branchId: string }[]) ?? []}
                        onChange={(v) => setRules((p) => ({ ...p, [rule.id]: v }))}
                      />
                    )}
                    {active && rule.id === "subjectEmphasis" && (
                      <EmphasisEditor
                        branches={branches}
                        value={rules.subjectEmphasis ?? []}
                        onChange={(v) => setRules((p) => ({ ...p, subjectEmphasis: v }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={onlyBranchId}
            onChange={(e) => setOnlyBranchId(e.target.value)}
            className="min-h-[38px] rounded-xl border border-hairline bg-white px-2.5 text-[12.5px] text-espresso dark:border-white/10 dark:bg-midnight dark:text-cream"
          >
            <option value="">Tüm kurum</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                Sadece {b.name}
              </option>
            ))}
          </select>
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

            {/* Kural uyum raporu — "elinden geldiğince uydu" iddiasının kanıtı. */}
            {preview.compliance.length > 0 && (
              <div className="rounded-2xl border border-hairline bg-white p-3 dark:border-white/10 dark:bg-midnight-card/50">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-espresso-muted dark:text-cream/40">
                  Kurallara uyum
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.compliance.map((c) => {
                    const pct = c.total > 0 ? Math.round((c.satisfied / c.total) * 100) : 100;
                    const label = RULE_CATALOG.find((r) => r.id === c.ruleId)?.label ?? c.ruleId;
                    return (
                      <span
                        key={c.ruleId}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums",
                          pct >= 80
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : pct >= 50
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                        )}
                      >
                        {label}: {c.detail ?? `%${pct}`}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[10.5px] text-espresso-muted dark:text-cream/40">
                  Tercih kuralları &quot;elinden geldiğince&quot; uygulanır; kadro ve saat kısıtı yüzünden %100
                  olmayabilir. Kesin kurallar (öğretmen izni, yasak eşleşme) her zaman %100&apos;dür.
                </p>
              </div>
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
