"use client";

import { useState } from "react";
import {
  Loader2,
  UserX,
  UserCheck,
  KeyRound,
  ArrowRightLeft,
  GraduationCap,
  CalendarPlus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Undo2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { runChunked, DEFAULT_CHUNK_SIZE } from "@/lib/client/chunked-import";
import { refreshInstitutionCounts } from "@/lib/institution-counts";
import { cn } from "@/lib/utils";

type BulkAction = "DEACTIVATE" | "REACTIVATE" | "RESET_PASSWORD" | "CHANGE_BRANCH" | "PROMOTE_GRADE" | "RENEW_ENROLLMENT" | "DELETE";
type ItemResult = { id: string; name: string; ok: boolean; reason?: string };
type Credential = { fullName: string; username: string; password: string; phone?: string; institutionalCode?: string };
type PromotionPair = {
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string | null;
  toBranchName: string | null;
  studentCount: number;
  problem?: string;
};

type ActionSpec = {
  action: BulkAction;
  label: string;
  hint: string;
  icon: typeof UserX;
  studentOnly?: boolean;
  danger?: boolean;
};

const ACTIONS: ActionSpec[] = [
  { action: "DEACTIVATE", label: "Pasifleştir", hint: "Giriş yapamaz, listelerden düşer. Geçmişi durur.", icon: UserX },
  { action: "REACTIVATE", label: "Aktifleştir", hint: "Pasif kayıtları geri açar.", icon: UserCheck },
  { action: "RESET_PASSWORD", label: "Şifre Sıfırla", hint: "Yeni geçici şifreler üretir, tek PDF olarak indirilir.", icon: KeyRound },
  { action: "CHANGE_BRANCH", label: "Şube Değiştir", hint: "Seçilenleri tek bir şubeye taşır.", icon: ArrowRightLeft, studentOnly: true },
  { action: "PROMOTE_GRADE", label: "Sınıf Atlat", hint: "Bir üst kademeye taşır — önce eşlemeyi onaylarsınız.", icon: GraduationCap, studentOnly: true },
  { action: "RENEW_ENROLLMENT", label: "Kayıt Yenile", hint: "Gelecek dönem kaydını açar; geçen yılın kaydı silinmez.", icon: CalendarPlus, studentOnly: true },
  { action: "DELETE", label: "Kalıcı Sil", hint: "Geri alınamaz. Mali/akademik geçmişi olanlar silinemez.", icon: Trash2, danger: true },
];

// Kullanıcı listesindeki toplu işlem paneli.
//
// Akış bilerek üç adımlı: işlemi seç → (varsa) ayarını gir → sonucu gör.
// "Sınıf atlat" tek istisna olarak arada bir ONAY adımı daha ister,
// çünkü hedef şube eşlemesi tahmindir ve 100 öğrenciyi yanlış şubeye
// taşımak tek tek taşımaktan pahalıdır.
export function BulkActionsModal({
  isOpen,
  onClose,
  role,
  ids,
  branches,
  onDone,
}: {
  isOpen: boolean;
  onClose: () => void;
  role: "STUDENT" | "TEACHER";
  ids: string[];
  branches: { id: string; name: string }[];
  onDone: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [action, setAction] = useState<BulkAction | null>(null);
  const [targetBranchId, setTargetBranchId] = useState("");
  const [pairs, setPairs] = useState<PromotionPair[] | null>(null);
  const [renewStart, setRenewStart] = useState("");
  const [renewAmount, setRenewAmount] = useState("");
  const [renewCount, setRenewCount] = useState("");
  const [running, setRunning] = useState(false);
  const [percent, setPercent] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [results, setResults] = useState<ItemResult[] | null>(null);
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [undoId, setUndoId] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);

  const available = ACTIONS.filter((a) => role === "STUDENT" || !a.studentOnly);
  const spec = ACTIONS.find((a) => a.action === action) ?? null;

  function reset() {
    setAction(null);
    setTargetBranchId("");
    setPairs(null);
    setRenewStart("");
    setRenewAmount("");
    setRenewCount("");
    setResults(null);
    setCredentials(null);
    setUndoId(null);
    setUndone(false);
    setPercent(0);
    setDoneCount(0);
  }

  function handleClose() {
    if (running) return;
    // Sonuç ekranı kapanıyorsa liste tazelenir — pasifleştirilen kayıtlar
    // ancak o zaman doğru görünür.
    if (results) onDone();
    reset();
    onClose();
  }

  async function loadPromotionPreview() {
    setRunning(true);
    try {
      const res = await fetch(`/api/admin/users/bulk-action?ids=${ids.join(",")}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Önizleme alınamadı.");
      setPairs(data.pairs ?? []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Önizleme alınamadı.");
      setAction(null);
    } finally {
      setRunning(false);
    }
  }

  async function run() {
    if (!action) return;
    setRunning(true);
    setResults(null);
    const collectedCredentials: Credential[] = [];
    const collectedUndoIds: string[] = [];

    const branchMap =
      action === "PROMOTE_GRADE"
        ? Object.fromEntries((pairs ?? []).filter((p) => p.toBranchId).map((p) => [p.fromBranchId, p.toBranchId as string]))
        : undefined;

    try {
      const items = await runChunked<string, ItemResult>(
        ids,
        DEFAULT_CHUNK_SIZE,
        async (chunk) => {
          const res = await fetch("/api/admin/users/bulk-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              role,
              ids: chunk,
              targetBranchId: action === "CHANGE_BRANCH" ? targetBranchId : undefined,
              branchMap,
              renewal:
                action === "RENEW_ENROLLMENT"
                  ? {
                      startDate: renewStart,
                      listAmount: renewAmount ? Number(renewAmount) : null,
                      installmentCount: renewCount ? Number(renewCount) : null,
                    }
                  : undefined,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? "İşlem başarısız.");
          if (Array.isArray(data.credentials)) collectedCredentials.push(...data.credentials);
          // ⚠️ Her parça KENDİ denetim kaydını yazar. Tek bir id
          // tutulsaydı 100 kayıtlık bir işlemin yalnızca son 25'i geri
          // alınırdı — hepsi toplanıp sırayla geri sarılıyor.
          if (data.undoId) collectedUndoIds.push(data.undoId as string);
          return (data.items ?? []) as ItemResult[];
        },
        (p) => {
          setPercent(p.percent);
          setDoneCount(p.done);
        }
      );

      setResults(items);
      if (collectedCredentials.length > 0) setCredentials(collectedCredentials);
      // Pasifleştirme/silme aktif sayıyı değiştirir; üst bardaki sayaç
      // eski değeri göstermesin.
      refreshInstitutionCounts();
      if (collectedUndoIds.length > 0) setUndoId(collectedUndoIds.join(","));
      const ok = items.filter((i) => i.ok).length;
      if (ok === items.length) showSuccess(`${ok} kayıt işlendi.`);
      else showError(`${ok} kayıt işlendi, ${items.length - ok} tanesi yapılamadı — sebepleri aşağıda.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "İşlem başarısız.");
    } finally {
      setRunning(false);
    }
  }


  // Geri alma. Parçalı gönderim yüzünden birden fazla denetim kaydı
  // olabilir; hepsi sırayla geri sarılır.
  async function undo() {
    if (!undoId) return;
    setRunning(true);
    try {
      let total = 0;
      for (const id of undoId.split(",")) {
        const res = await fetch(`/api/admin/users/bulk-action?undo=${encodeURIComponent(id)}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Geri alınamadı.");
        total += data.reverted ?? 0;
      }
      showSuccess(`${total} kayıt eski haline döndürüldü.`);
      setUndone(true);
      refreshInstitutionCounts();
      onDone();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Geri alınamadı.");
    } finally {
      setRunning(false);
    }
  }

  async function downloadCredentials() {
    if (!credentials) return;
    try {
      const res = await fetch("/api/admin/users/credentials-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, credentials }),
      });
      if (!res.ok) throw new Error("PDF oluşturulamadı.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      showError(error instanceof Error ? error.message : "PDF oluşturulamadı.");
    }
  }

  const canRun =
    !!action &&
    !running &&
    (action !== "CHANGE_BRANCH" || !!targetBranchId) &&
    (action !== "RENEW_ENROLLMENT" || !!renewStart) &&
    (action !== "PROMOTE_GRADE" || (pairs?.some((p) => p.toBranchId) ?? false));

  const noun = role === "STUDENT" ? "öğrenci" : "öğretmen";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Toplu İşlem · ${ids.length} ${noun}`} variant="center" widthClassName="max-w-2xl">
      <div className="space-y-4">
        {/* 1) İşlem seçimi */}
        {!results && (
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((a) => {
              const Icon = a.icon;
              const selected = action === a.action;
              return (
                <button
                  key={a.action}
                  onClick={() => {
                    setAction(a.action);
                    setPairs(null);
                    if (a.action === "PROMOTE_GRADE") void loadPromotionPreview();
                  }}
                  disabled={running}
                  className={cn(
                    "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                    selected
                      ? a.danger
                        ? "border-red-500 bg-red-50 dark:bg-red-500/10"
                        : "border-brand-600 bg-brand-50 dark:bg-brand-600/10"
                      : "border-hairline hover:bg-cream-card dark:border-white/10 dark:hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", a.danger ? "text-red-600" : "text-brand-600")} />
                  <div className="min-w-0">
                    <p className={cn("text-sm font-medium", a.danger ? "text-red-700 dark:text-red-400" : "text-espresso dark:text-cream")}>{a.label}</p>
                    <p className="text-[11px] leading-snug text-espresso-muted dark:text-cream/40">{a.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* 2) İşleme özel ayar */}
        {!results && action === "CHANGE_BRANCH" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">Hedef şube</label>
            <select
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            >
              <option value="">Şube seçin...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        {!results && action === "PROMOTE_GRADE" && (
          <div className="space-y-2">
            <p className="text-[11px] text-espresso-muted dark:text-cream/40">
              Eşleme tahmin edildi. Uygulanmadan önce kontrol edin — hedefi olmayan şubedeki öğrenciler taşınmaz.
            </p>
            {running && !pairs && <p className="text-xs text-espresso-muted dark:text-cream/40">Önizleme hazırlanıyor...</p>}
            {pairs?.map((p) => (
              <div
                key={p.fromBranchId}
                className={cn(
                  "flex flex-wrap items-center gap-2 rounded-xl border p-2.5 text-xs",
                  p.toBranchId ? "border-hairline dark:border-white/10" : "border-amber-500/50 bg-amber-50 dark:bg-amber-500/10"
                )}
              >
                <span className="font-medium text-espresso dark:text-cream">{p.fromBranchName}</span>
                <span className="text-espresso-muted dark:text-cream/40">({p.studentCount} öğrenci)</span>
                <ArrowRightLeft className="h-3 w-3 text-espresso-muted dark:text-cream/40" />
                <select
                  value={p.toBranchId ?? ""}
                  onChange={(e) =>
                    setPairs((prev) =>
                      (prev ?? []).map((x) =>
                        x.fromBranchId === p.fromBranchId
                          ? { ...x, toBranchId: e.target.value || null, toBranchName: branches.find((b) => b.id === e.target.value)?.name ?? null }
                          : x
                      )
                    )
                  }
                  className="rounded-lg border border-hairline bg-white px-2 py-1 text-xs text-espresso outline-none dark:border-white/10 dark:bg-midnight dark:text-cream"
                >
                  <option value="">Taşıma</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {p.problem && <span className="w-full text-[11px] text-amber-700 dark:text-amber-400">{p.problem}</span>}
              </div>
            ))}
          </div>
        )}

        {!results && action === "RENEW_ENROLLMENT" && (
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">Yeni dönem başlangıcı</label>
              <input
                type="date"
                value={renewStart}
                onChange={(e) => setRenewStart(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">Yeni yıl ücreti (boş = plan kurulmaz)</label>
              <input
                type="number"
                value={renewAmount}
                onChange={(e) => setRenewAmount(e.target.value)}
                placeholder="Örn. 120000"
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-espresso-muted dark:text-cream/40">Taksit</label>
              <input
                type="number"
                value={renewCount}
                onChange={(e) => setRenewCount(e.target.value)}
                placeholder="10"
                className="w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm text-espresso outline-none focus:border-brand-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
              />
            </div>
            <p className="sm:col-span-3 text-[11px] text-espresso-muted dark:text-cream/40">
              Herkese aynı ücret yazılır. Farklı ücretli öğrenciler için tek tek yenileme ekranını kullanın.
            </p>
          </div>
        )}

        {!results && spec?.danger && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-50 p-3 dark:bg-red-500/10">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <p className="text-[11px] leading-snug text-red-700 dark:text-red-400">
              Bu işlem geri alınamaz. Not, devamsızlık, ödeme geçmişi olan kayıtlar silinemez — bunlar sonuç listesinde
              sebebiyle gösterilir. Çoğu durumda doğru seçim &quot;Pasifleştir&quot;dir.
            </p>
          </div>
        )}

        {/* 3) İlerleme */}
        {running && action && (
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-espresso-muted dark:text-cream/40">
              <span>İşleniyor...</span>
              <span>{doneCount}/{ids.length}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        )}

        {/* 4) Sonuç */}
        {results && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl bg-cream-card p-3 dark:bg-white/5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-sm text-espresso dark:text-cream">
                {results.filter((r) => r.ok).length} başarılı
                {results.some((r) => !r.ok) && `, ${results.filter((r) => !r.ok).length} yapılamadı`}
              </p>
              {undoId && !undone && (
                <button
                  onClick={undo}
                  disabled={running}
                  className="ml-auto flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-espresso transition hover:bg-white disabled:opacity-50 dark:border-white/10 dark:text-cream dark:hover:bg-white/10"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Geri Al
                </button>
              )}
              {undone && (
                <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400">Geri alındı</span>
              )}
              {credentials && (
                <button
                  onClick={downloadCredentials}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-espresso px-3 py-1.5 text-xs font-medium text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
                >
                  <Download className="h-3.5 w-3.5" /> Şifreleri PDF indir
                </button>
              )}
            </div>
            {credentials && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Geçici şifreler yalnızca şimdi görülebilir; bu pencere kapanınca bir daha gösterilemez.
              </p>
            )}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {results
                .filter((r) => !r.ok || r.reason)
                .map((r) => (
                  <div key={r.id} className="flex items-start gap-2 rounded-lg bg-cream-card px-2.5 py-1.5 text-[11px] dark:bg-white/5">
                    <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full", r.ok ? "bg-amber-500" : "bg-red-500")} />
                    <span className="font-medium text-espresso dark:text-cream">{r.name}</span>
                    <span className="text-espresso-muted dark:text-cream/40">{r.reason}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={handleClose}
            disabled={running}
            className="rounded-xl border border-hairline px-4 py-2 text-sm font-medium text-espresso transition hover:bg-cream-card disabled:opacity-50 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            {results ? "Kapat" : "Vazgeç"}
          </button>
          {!results && (
            <button
              onClick={run}
              disabled={!canRun}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-cream transition disabled:opacity-40",
                spec?.danger ? "bg-red-600 hover:bg-red-700" : "bg-espresso hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
              )}
            >
              {running && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {spec ? `${spec.label} (${ids.length})` : "İşlem seçin"}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
