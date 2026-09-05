"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Plus, Trash2, ScanLine } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/lib/toast-context";

export type OpticalSubjectBlockInput = { subject: string; start: number; length: number };
export type OpticalFormat = {
  id: string;
  name: string;
  tcNoStart: number | null;
  tcNoLength: number | null;
  studentNoStart: number | null;
  studentNoLength: number | null;
  bookletStart: number | null;
  bookletLength: number | null;
  gradeStart: number | null;
  gradeLength: number | null;
  branchStart: number | null;
  branchLength: number | null;
  nameStart: number | null;
  nameLength: number | null;
  subjectBlocks: OpticalSubjectBlockInput[];
};

type FieldKey = "tcNo" | "studentNo" | "booklet" | "grade" | "branch" | "nameField";
const FIELD_LABELS: Record<FieldKey, string> = {
  tcNo: "T.C. Numarası",
  studentNo: "Öğrenci Numarası",
  booklet: "Kitapçık Türü",
  grade: "Sınıf",
  branch: "Şube",
  nameField: "Ad Soyad",
};

type FieldState = Record<FieldKey, { start: string; length: string }>;
const EMPTY_FIELDS: FieldState = {
  tcNo: { start: "", length: "" },
  studentNo: { start: "", length: "" },
  booklet: { start: "", length: "" },
  grade: { start: "", length: "" },
  branch: { start: "", length: "" },
  nameField: { start: "", length: "" },
};

function toFieldState(f: OpticalFormat | null): FieldState {
  if (!f) return EMPTY_FIELDS;
  return {
    tcNo: { start: f.tcNoStart ? String(f.tcNoStart) : "", length: f.tcNoLength ? String(f.tcNoLength) : "" },
    studentNo: { start: f.studentNoStart ? String(f.studentNoStart) : "", length: f.studentNoLength ? String(f.studentNoLength) : "" },
    booklet: { start: f.bookletStart ? String(f.bookletStart) : "", length: f.bookletLength ? String(f.bookletLength) : "" },
    grade: { start: f.gradeStart ? String(f.gradeStart) : "", length: f.gradeLength ? String(f.gradeLength) : "" },
    branch: { start: f.branchStart ? String(f.branchStart) : "", length: f.branchLength ? String(f.branchLength) : "" },
    nameField: { start: f.nameStart ? String(f.nameStart) : "", length: f.nameLength ? String(f.nameLength) : "" },
  };
}

// Optik format tanımlama — edesis'in "Optik Parametreleri" ekranıyla AYNI
// mantık: sabit-genişlikli metin dosyasındaki her alan bir (Başlangıç,
// Uzunluk) çifti (1-tabanlı karakter pozisyonu). Kurum bazlı, birden çok
// sınavda tekrar kullanılır (bkz. prisma > OpticalFormat).
export function OpticalFormatManager({ isOpen, onClose, onSaved }: { isOpen: boolean; onClose: () => void; onSaved: () => void }) {
  const { showError, showSuccess } = useToast();
  const [formats, setFormats] = useState<OpticalFormat[] | null>(null);
  const [editing, setEditing] = useState<OpticalFormat | "new" | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FieldState>(EMPTY_FIELDS);
  const [subjectBlocks, setSubjectBlocks] = useState<OpticalSubjectBlockInput[]>([{ subject: "", start: 0, length: 0 }]);
  const [saving, setSaving] = useState(false);

  function load() {
    setFormats(null);
    fetch("/api/optical-formats")
      .then((res) => res.json())
      .then((data) => setFormats(data.formats ?? []))
      .catch(() => showError("Optik formatlar yüklenemedi."));
  }

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function startNew() {
    setEditing("new");
    setName("");
    setFields(EMPTY_FIELDS);
    setSubjectBlocks([{ subject: "", start: 0, length: 0 }]);
  }

  function startEdit(f: OpticalFormat) {
    setEditing(f);
    setName(f.name);
    setFields(toFieldState(f));
    setSubjectBlocks(f.subjectBlocks.length > 0 ? f.subjectBlocks : [{ subject: "", start: 0, length: 0 }]);
  }

  function fieldPayload(key: FieldKey): { start: number; length: number } | null {
    const start = Number(fields[key].start);
    const length = Number(fields[key].length);
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1) return null;
    return { start, length };
  }

  async function save() {
    if (!name.trim()) return showError("Format adı zorunludur.");
    const tcNo = fieldPayload("tcNo");
    const nameField = fieldPayload("nameField");
    if (!tcNo && !nameField) return showError("T.C. No veya Ad Soyad alanlarından en az biri gerekli.");

    const cleanBlocks = subjectBlocks.filter((b) => b.subject.trim() && b.start > 0 && b.length > 0);
    if (cleanBlocks.length === 0) return showError("En az bir ders bloğu (sütun aralığı) tanımla.");

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        tcNo,
        studentNo: fieldPayload("studentNo"),
        booklet: fieldPayload("booklet"),
        grade: fieldPayload("grade"),
        branch: fieldPayload("branch"),
        nameField,
        subjectBlocks: cleanBlocks,
      };
      const url = editing === "new" ? "/api/optical-formats" : `/api/optical-formats/${(editing as OpticalFormat).id}`;
      const method = editing === "new" ? "POST" : "PUT";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Optik format kaydedildi.");
      setEditing(null);
      load();
      onSaved();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Bu optik format silinsin mi? Onu kullanan geçmiş yüklemeler etkilenmez.")) return;
    try {
      const res = await fetch(`/api/optical-formats/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Silinemedi.");
      load();
      onSaved();
    } catch {
      showError("Silinemedi.");
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Optik Format Tanımlama" widthClassName="max-w-2xl">
      {editing === null ? (
        <div className="space-y-3">
          <p className="text-[11px] text-espresso-muted dark:text-cream/40">
            Optik tarayıcının ürettiği sabit-genişlikli metin dosyasında hangi karakter aralığının hangi alana (T.C. No, Ad Soyad, her dersin cevap
            harfleri…) karşılık geldiğini tanımla. Tarayıcı markası/formatı değişmediği sürece bir kez tanımlanır, her sınavda tekrar kullanılır.
          </p>
          <button
            onClick={startNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 py-2.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Plus className="h-4 w-4" /> Yeni Optik Format Tanımla
          </button>

          {formats === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : formats.length === 0 ? (
            <p className="rounded-xl border border-dashed border-hairline py-6 text-center text-[11px] text-espresso-muted dark:border-white/10 dark:text-cream/40">
              Henüz optik format tanımlanmadı.
            </p>
          ) : (
            <div className="space-y-1.5">
              {formats.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-white/60 px-3 py-2.5 dark:border-white/10 dark:bg-white/5"
                >
                  <button onClick={() => startEdit(f)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ScanLine className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-espresso dark:text-cream">{f.name}</span>
                      <span className="block text-[10px] text-espresso-muted dark:text-cream/40">{f.subjectBlocks.map((b) => b.subject).join(", ") || "ders bloğu yok"}</span>
                    </span>
                  </button>
                  <button onClick={() => remove(f.id)} className="shrink-0 rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-500/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Format Adı</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="örn. Standart Optik Formatı"
              className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
            />
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold text-espresso dark:text-cream">Kimlik Alanları (Başlangıç / Uzunluk)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((key) => (
                <div key={key} className="rounded-lg border border-hairline p-2 dark:border-white/10">
                  <p className="mb-1 truncate text-[10px] font-medium text-espresso-muted dark:text-cream/40">{FIELD_LABELS[key]}</p>
                  <div className="flex gap-1">
                    <input
                      value={fields[key].start}
                      onChange={(e) => setFields((prev) => ({ ...prev, [key]: { ...prev[key], start: e.target.value } }))}
                      placeholder="Başl."
                      inputMode="numeric"
                      className="w-1/2 rounded border border-hairline bg-white px-1.5 py-1 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    />
                    <input
                      value={fields[key].length}
                      onChange={(e) => setFields((prev) => ({ ...prev, [key]: { ...prev[key], length: e.target.value } }))}
                      placeholder="Uzun."
                      inputMode="numeric"
                      className="w-1/2 rounded border border-hairline bg-white px-1.5 py-1 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-espresso dark:text-cream">Ders Blokları (her ders kendi sütun aralığı)</p>
              <button
                onClick={() => setSubjectBlocks((prev) => [...prev, { subject: "", start: 0, length: 0 }])}
                className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[10.5px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
              >
                <Plus className="h-3 w-3" /> Ders Ekle
              </button>
            </div>
            <div className="space-y-1.5">
              {subjectBlocks.map((block, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={block.subject}
                    onChange={(e) => setSubjectBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, subject: e.target.value } : b)))}
                    placeholder="Ders adı (örn. Matematik)"
                    className="flex-1 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                  />
                  <input
                    value={block.start || ""}
                    onChange={(e) => setSubjectBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, start: Number(e.target.value) } : b)))}
                    placeholder="Başl."
                    inputMode="numeric"
                    className="w-16 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                  />
                  <input
                    value={block.length || ""}
                    onChange={(e) => setSubjectBlocks((prev) => prev.map((b, j) => (j === i ? { ...b, length: Number(e.target.value) } : b)))}
                    placeholder="Uzun. (soru say.)"
                    inputMode="numeric"
                    className="w-16 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                  />
                  <button
                    onClick={() => setSubjectBlocks((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditing(null)}
              className="flex-1 rounded-xl border border-hairline py-2.5 text-xs font-semibold text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
            >
              Vazgeç
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
