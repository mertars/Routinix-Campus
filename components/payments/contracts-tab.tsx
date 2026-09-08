"use client";

import { useEffect, useState } from "react";
import { Plus, Loader2, FileText, Link2, FileDown, CheckCircle2, Clock, Send, XCircle, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { currentAcademicYear, academicYearOptions } from "@/lib/payments/academic-year";
import { cn } from "@/lib/utils";

type ContractRow = {
  id: string;
  title: string;
  studentName: string;
  branchName: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  totalAmount: number | null;
  installmentCount: number | null;
  shareToken: string;
  signerName: string | null;
  signedAt: string | null;
  createdAt: string;
};
type TemplateRow = { id: string; title: string; content: string };
type RosterStudent = { id: string; firstName: string; lastName: string; branchName: string; grade: number };

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 });
}

const STATUS_META: Record<ContractRow["status"], { label: string; className: string; icon: typeof Clock }> = {
  DRAFT: { label: "Taslak", className: "bg-gray-500/10 text-gray-600 dark:text-gray-400", icon: FileText },
  SENT: { label: "İmza Bekliyor", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300", icon: Clock },
  SIGNED: { label: "İmzalandı", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
  CANCELLED: { label: "İptal", className: "bg-rose-500/10 text-rose-700 dark:text-rose-300", icon: XCircle },
};

export function ContractsTab() {
  const { showError, showSuccess } = useToast();
  const [contracts, setContracts] = useState<ContractRow[] | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  function loadContracts() {
    return fetch("/api/payments/principal/contracts")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => setContracts(d.contracts ?? []))
      .catch(() => showError("Sözleşmeler yüklenemedi."));
  }

  useEffect(() => {
    loadContracts();
    fetch("/api/payments/principal/contract-templates")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => showError("Şablonlar yüklenemedi."));
    fetch("/api/payments/principal/students")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((d) => setRoster(d.students ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyLink(contract: ContractRow) {
    const url = `${window.location.origin}/sozlesme/${contract.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess("İmza bağlantısı kopyalandı — WhatsApp/SMS ile veliye gönderebilirsiniz.");
    } catch {
      // Pano izni yoksa (bazı tarayıcı/HTTP bağlamları) bağlantıyı kaybettirmemek için
      // kullanıcıya doğrudan gösteriyoruz.
      window.prompt("İmza bağlantısı:", url);
    }
    if (contract.status === "DRAFT") {
      await fetch("/api/payments/principal/contracts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contract.id, action: "send" }),
      });
      loadContracts();
    }
  }

  async function cancelContract(id: string) {
    if (!window.confirm("Bu sözleşme iptal edilsin mi?")) return;
    const res = await fetch("/api/payments/principal/contracts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "cancel" }),
    });
    if (res.ok) {
      showSuccess("Sözleşme iptal edildi.");
      loadContracts();
    } else showError("Sözleşme iptal edilemedi.");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso dark:text-cream">Sözleşmeler</h3>
        <button
          onClick={() => setCreateOpen(true)}
          disabled={templates.length === 0}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Yeni Sözleşme
        </button>
      </div>

      {!contracts ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-white/20">
          <FileText className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-espresso-muted dark:text-cream/60">Henüz sözleşme yok. Öğrenci seçip kayıt sözleşmesi oluşturun.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((c) => {
            const meta = STATUS_META[c.status];
            return (
              <div key={c.id} className="flex flex-col gap-2 rounded-xl border border-hairline p-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-espresso dark:text-cream">{c.studentName}</p>
                  <p className="truncate text-xs text-espresso-muted dark:text-cream/40">
                    {c.title} · {c.branchName}
                    {c.totalAmount != null ? ` · ${formatTRY(c.totalAmount)}` : ""}
                    {c.signedAt ? ` · ${c.signerName} imzaladı (${new Date(c.signedAt).toLocaleDateString("tr-TR")})` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold", meta.className)}>
                    <meta.icon className="h-3 w-3" /> {meta.label}
                  </span>
                  {c.status !== "CANCELLED" && (
                    <button
                      onClick={() => copyLink(c)}
                      title="İmza bağlantısını kopyala"
                      className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      {c.status === "DRAFT" ? <Send className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                      {c.status === "DRAFT" ? "Veliye Gönder" : "Bağlantı"}
                    </button>
                  )}
                  <a
                    href={`/api/payments/principal/contracts/${c.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                  >
                    <FileDown className="h-3 w-3" /> PDF
                  </a>
                  {c.status !== "SIGNED" && c.status !== "CANCELLED" && (
                    <button
                      onClick={() => cancelContract(c.id)}
                      className="rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-500/10 dark:border-white/10 dark:text-rose-400"
                    >
                      İptal
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateContractModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        templates={templates}
        roster={roster}
        onCreated={loadContracts}
      />
    </div>
  );
}

function CreateContractModal({
  isOpen,
  onClose,
  templates,
  roster,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  templates: TemplateRow[];
  roster: RosterStudent[];
  onCreated: () => void;
}) {
  const { showError, showSuccess } = useToast();
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("12");
  const [academicYear, setAcademicYear] = useState(currentAcademicYear());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setStudentId("");
    setTemplateId(templates[0]?.id ?? "");
    setTotalAmount("");
  }, [isOpen, templates]);

  const filtered = query.trim()
    ? roster.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(query.trim().toLocaleLowerCase("tr-TR")))
    : roster.slice(0, 30);

  async function handleSubmit() {
    if (!studentId) return showError("Bir öğrenci seçin.");
    if (!templateId) return showError("Bir şablon seçin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          templateId,
          totalAmount: totalAmount ? Number(totalAmount) : undefined,
          installmentCount: installmentCount ? Number(installmentCount) : undefined,
          academicYear,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Sözleşme oluşturuldu. Şimdi veliye bağlantıyı gönderebilirsiniz.");
      onCreated();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Sözleşme oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";
  const selectedStudent = roster.find((s) => s.id === studentId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Sözleşme" variant="center" widthClassName="max-w-md">
      <div className="space-y-3.5">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Öğrenci</label>
          {selectedStudent ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
              <span className="truncate text-sm text-espresso dark:text-cream">
                {selectedStudent.firstName} {selectedStudent.lastName} · {selectedStudent.branchName}
              </span>
              <button onClick={() => setStudentId("")} className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Değiştir
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Öğrenci ara..." className={cn(inputClass, "pl-8")} />
              </div>
              <div className="mt-1.5 max-h-40 space-y-1 overflow-y-auto pr-1">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStudentId(s.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition hover:bg-cream-card dark:hover:bg-white/5"
                  >
                    <span className="truncate text-xs text-espresso dark:text-cream">
                      {s.firstName} {s.lastName}
                    </span>
                    <span className="shrink-0 text-[10px] text-espresso-muted dark:text-cream/40">{s.branchName}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Şablon</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inputClass}>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Öğrenim Yılı</label>
            <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className={inputClass} />
          </div>
          <div className="col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Ücret (₺)</label>
            <input type="number" inputMode="decimal" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} placeholder="72000" className={inputClass} />
          </div>
          <div className="col-span-1">
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Taksit</label>
            <input type="number" inputMode="numeric" value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} className={inputClass} />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Sözleşme Oluştur
        </button>
      </div>
    </Modal>
  );
}
