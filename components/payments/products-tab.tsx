"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Package, CalendarDays, Users, Search, CheckCircle2, Send, GraduationCap } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  name: string;
  type: "PRODUCT" | "EVENT";
  description: string | null;
  price: number;
  eventDate: string | null;
  capacity: number | null;
  assignedCount: number;
  paidCount: number;
  expected: number;
  collected: number;
};
type RosterStudent = { id: string; firstName: string; lastName: string; branchName: string; grade: number };
type Participant = {
  installmentId: string;
  studentId: string;
  studentName: string;
  branchName: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueDate: string;
};

function formatTRY(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

export function ProductsTab({ onChanged }: { onChanged: () => void }) {
  const { showError } = useToast();
  const [products, setProducts] = useState<ProductRow[] | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<ProductRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<ProductRow | null>(null);

  function loadProducts() {
    return fetch("/api/payments/principal/products")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setProducts(d.products ?? []))
      .catch(() => showError("Ürün/etkinlik listesi yüklenemedi."));
  }

  useEffect(() => {
    loadProducts();
    fetch("/api/payments/principal/students")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setRoster(d.students ?? []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    loadProducts();
    onChanged();
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-espresso dark:text-cream">Ürün & Etkinlik</h3>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          <Plus className="h-3.5 w-3.5" /> Yeni Kayıt
        </button>
      </div>
      <p className="mb-4 text-[11px] text-espresso-muted dark:text-cream/40">
        Kitap, gezi, deneme, kıyafet gibi ek gelirler. Öğrenciye atandığında tahsilat defterine düşer; kontrol paneli, gecikmiş listesi ve raporlarda otomatik görünür.
      </p>

      {!products ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center dark:border-white/20">
          <Package className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-espresso-muted dark:text-cream/60">Henüz ürün/etkinlik yok.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => {
            const rate = p.expected > 0 ? (p.collected / p.expected) * 100 : 0;
            return (
              <div key={p.id} className="flex flex-col rounded-2xl border border-hairline bg-white p-4 dark:border-white/5 dark:bg-midnight-card/50">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      p.type === "EVENT" ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {p.type === "EVENT" ? <CalendarDays className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                  </div>
                  <span className="text-sm font-bold text-espresso dark:text-cream">{formatTRY(p.price)}</span>
                </div>

                <p className="truncate text-sm font-semibold text-espresso dark:text-cream">{p.name}</p>
                <p className="mb-3 truncate text-[11px] text-espresso-muted dark:text-cream/40">
                  {p.type === "EVENT" ? "Etkinlik" : "Ürün"}
                  {p.eventDate ? ` · ${new Date(p.eventDate).toLocaleDateString("tr-TR")}` : ""}
                  {p.capacity != null ? ` · kontenjan ${p.assignedCount}/${p.capacity}` : ""}
                </p>

                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-espresso-muted dark:text-cream/40">
                    {p.assignedCount} katılımcı · {p.paidCount} ödedi
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">%{Math.round(rate)}</span>
                </div>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-cream-card dark:bg-white/10">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, rate)}%` }} />
                </div>
                <p className="mb-3 text-[11px] text-espresso-muted dark:text-cream/40">
                  {formatTRY(p.collected)} / {formatTRY(p.expected)} tahsil edildi
                </p>

                <div className="mt-auto flex gap-2">
                  <button
                    onClick={() => setAssignTarget(p)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-500"
                  >
                    <Send className="h-3 w-3" /> Öğrenciye Ata
                  </button>
                  <button
                    onClick={() => setDetailTarget(p)}
                    disabled={p.assignedCount === 0}
                    className="flex items-center justify-center gap-1 rounded-full border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-espresso transition hover:bg-cream-card disabled:opacity-40 dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
                  >
                    <Users className="h-3 w-3" /> Liste
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateProductModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onCreated={refresh} />
      <AssignModal product={assignTarget} roster={roster} onClose={() => setAssignTarget(null)} onAssigned={refresh} />
      <ParticipantsModal product={detailTarget} onClose={() => setDetailTarget(null)} />
    </div>
  );
}

function CreateProductModal({ isOpen, onClose, onCreated }: { isOpen: boolean; onClose: () => void; onCreated: () => void }) {
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<"PRODUCT" | "EVENT">("PRODUCT");
  const [price, setPrice] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setType("PRODUCT");
    setPrice("");
    setEventDate("");
    setCapacity("");
  }, [isOpen]);

  async function save() {
    const value = Number(price);
    if (!name.trim()) return showError("Ad girin.");
    if (!Number.isFinite(value) || value <= 0) return showError("Geçerli bir fiyat girin.");
    setSaving(true);
    try {
      const res = await fetch("/api/payments/principal/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          price: value,
          eventDate: type === "EVENT" && eventDate ? eventDate : undefined,
          capacity: capacity ? Number(capacity) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error);
      }
      showSuccess("Kayıt oluşturuldu.");
      onCreated();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Oluşturulamadı.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-hairline bg-white px-3 py-2.5 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yeni Ürün / Etkinlik" variant="center" widthClassName="max-w-sm">
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setType("PRODUCT")}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition",
              type === "PRODUCT" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
            )}
          >
            <Package className="h-4 w-4" /> Ürün
          </button>
          <button
            onClick={() => setType("EVENT")}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition",
              type === "EVENT" ? "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300" : "border-hairline text-espresso-muted dark:border-white/10 dark:text-cream/50"
            )}
          >
            <CalendarDays className="h-4 w-4" /> Etkinlik
          </button>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Ad</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "EVENT" ? "Kapadokya Gezisi" : "YKS Kitap Seti"} className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Fiyat (₺)</label>
            <input type="number" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Kontenjan</label>
            <input type="number" inputMode="numeric" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="opsiyonel" className={inputClass} />
          </div>
        </div>

        {type === "EVENT" && (
          <div>
            <label className="mb-1.5 block text-xs font-medium text-espresso dark:text-cream">Etkinlik Tarihi</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputClass} />
          </div>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Oluştur
        </button>
      </div>
    </Modal>
  );
}

function AssignModal({
  product,
  roster,
  onClose,
  onAssigned,
}: {
  product: ProductRow | null;
  roster: RosterStudent[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const { showError, showToast } = useToast();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (product) {
      setSelected(new Set());
      setQuery("");
    }
  }, [product]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR");
    if (!q) return roster;
    return roster.filter((s) => `${s.firstName} ${s.lastName}`.toLocaleLowerCase("tr-TR").includes(q) || s.branchName.toLocaleLowerCase("tr-TR").includes(q));
  }, [roster, query]);

  // Şube bazlı hızlı seçim — bir gezi/kitap genelde sınıf sınıf atanır,
  // 30 öğrenciyi tek tek tıklatmak gereksiz (video atama modalındaki AYNI ilke).
  const branches = useMemo(() => [...new Set(roster.map((s) => s.branchName))].sort(), [roster]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectBranch(branchName: string) {
    setSelected((prev) => new Set([...prev, ...roster.filter((s) => s.branchName === branchName).map((s) => s.id)]));
  }

  async function assign() {
    if (!product || selected.size === 0) return;
    setSending(true);
    try {
      const res = await fetch(`/api/payments/principal/products/${product.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [...selected] }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error);
      showToast("success", `${d.assignedCount} öğrenciye atandı${d.skippedCount > 0 ? `, ${d.skippedCount} zaten atanmıştı` : ""}.`);
      onAssigned();
      onClose();
    } catch (e) {
      showError(e instanceof Error && e.message ? e.message : "Atama yapılamadı.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal isOpen={product != null} onClose={onClose} title={product ? `${product.name} — Öğrenciye Ata` : "Ata"} variant="center" widthClassName="max-w-lg">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {branches.slice(0, 8).map((b) => (
            <button
              key={b}
              onClick={() => selectBranch(b)}
              className="flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-2.5 py-1 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-500/10 dark:border-emerald-400/20 dark:text-emerald-300"
            >
              <GraduationCap className="h-3 w-3" /> {b}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-espresso-muted dark:text-cream/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Öğrenci veya şube ara..."
            className="w-full rounded-lg border border-hairline bg-white py-2 pl-8 pr-3 text-sm text-espresso outline-none focus:border-emerald-500 dark:border-white/10 dark:bg-midnight-card dark:text-cream"
          />
        </div>

        <div className="max-h-[40vh] space-y-1 overflow-y-auto pr-1">
          {filtered.map((s) => {
            const isSelected = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition",
                  isSelected ? "bg-emerald-500/10" : "hover:bg-cream-card dark:hover:bg-white/5"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-espresso dark:text-cream">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="block truncate text-[10px] text-espresso-muted dark:text-cream/40">{s.branchName}</span>
                </span>
                {isSelected && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={assign}
          disabled={sending || selected.size === 0}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {selected.size > 0 ? `${selected.size} Öğrenciye Ata (${formatTRY((product?.price ?? 0) * selected.size)})` : "Öğrenci Seç"}
        </button>
        <p className="text-[10px] text-espresso-muted dark:text-cream/40">
          Atanan her öğrenciye ürün fiyatı kadar bir tahsilat satırı açılır. Zaten atanmış öğrenciler atlanır.
        </p>
      </div>
    </Modal>
  );
}

function ParticipantsModal({ product, onClose }: { product: ProductRow | null; onClose: () => void }) {
  const { showError } = useToast();
  const [rows, setRows] = useState<Participant[] | null>(null);

  useEffect(() => {
    if (!product) return;
    setRows(null);
    fetch(`/api/payments/principal/products/${product.id}/assign`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d) => setRows(d.participants ?? []))
      .catch(() => showError("Katılımcı listesi yüklenemedi."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  return (
    <Modal isOpen={product != null} onClose={onClose} title={product ? `${product.name} — Katılımcılar` : "Katılımcılar"} variant="center" widthClassName="max-w-lg">
      {!rows ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.installmentId} className="flex items-center justify-between gap-2 rounded-xl border border-hairline px-3 py-2 dark:border-white/5">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-espresso dark:text-cream">{r.studentName}</p>
                <p className="truncate text-[10px] text-espresso-muted dark:text-cream/40">{r.branchName}</p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  r.status === "PAID"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : r.status === "PARTIALLY_PAID"
                      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                )}
              >
                {r.status === "PAID" ? "Ödendi" : r.status === "PARTIALLY_PAID" ? `${formatTRY(r.paidAmount)} ödendi` : "Bekliyor"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
