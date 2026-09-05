"use client";

import { useState } from "react";
import { Loader2, Save, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { cn } from "@/lib/utils";
import type { OpticalFormat, OpticalSubjectBlockInput } from "./optical-format-manager";

type FieldKey = "tcNo" | "studentNo" | "booklet" | "grade" | "branch" | "nameField";
const FIELD_LABELS: Record<FieldKey, string> = {
  tcNo: "T.C. Numarası",
  studentNo: "Öğrenci Numarası",
  booklet: "Kitapçık Türü",
  grade: "Sınıf",
  branch: "Şube",
  nameField: "Ad Soyad",
};
const FIELD_ORDER: FieldKey[] = ["tcNo", "studentNo", "nameField", "grade", "branch", "booklet"];

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

// Ekranın en kafa karıştıran kısmı buydu: "Başlangıç" karakter pozisyonunu
// elle sayıp bulmak. Şimdi iki yardım var: (1) örnek bir satır yapıştırınca
// her alanın yanında CANLI olarak hangi metni kestiği gösteriliyor —
// yanlış girilen bir uzunluk anında görülüyor; (2) yeni bir ders bloğu
// eklerken bir önceki alanın bittiği yerin hemen sonrası başlangıç olarak
// ÖNERİLİYOR (elle hesaplamaya gerek kalmıyor, istenirse değiştirilebilir).
export function OpticalFormatForm({
  initialName = "",
  lockName = false,
  initial = null,
  initialSubjectNames,
  onCancel,
  onSaved,
}: {
  initialName?: string;
  lockName?: boolean;
  initial?: OpticalFormat | null;
  // Sadece initial=null iken kullanılır — bir şablon PRESET'i (örn. "TYT")
  // seçildiğinde ders adlarını (Türkçe, Sosyal Bilimler…) ÖNCEDEN
  // doldurur, yönetici sadece Başlangıç/Uzunluk'u girer, ders adını
  // tekrar yazmasına gerek kalmaz.
  initialSubjectNames?: string[];
  onCancel: () => void;
  onSaved: (format: OpticalFormat) => void;
}) {
  const { showError, showSuccess } = useToast();
  const [name, setName] = useState(initial?.name ?? initialName);
  const [sampleLine, setSampleLine] = useState("");
  const [fields, setFields] = useState<FieldState>(toFieldState(initial));
  const [subjectBlocks, setSubjectBlocks] = useState<OpticalSubjectBlockInput[]>(() => {
    if (initial && initial.subjectBlocks.length > 0) return initial.subjectBlocks;
    if (initialSubjectNames && initialSubjectNames.length > 0) return initialSubjectNames.map((subject) => ({ subject, start: 0, length: 0 }));
    return [{ subject: "", start: 0, length: 0 }];
  });
  const [saving, setSaving] = useState(false);

  function fieldPayload(key: FieldKey): { start: number; length: number } | null {
    const start = Number(fields[key].start);
    const length = Number(fields[key].length);
    if (!Number.isInteger(start) || !Number.isInteger(length) || start < 1 || length < 1) return null;
    return { start, length };
  }

  function preview(start: number, length: number): string {
    if (!sampleLine || !start || !length) return "";
    const slice = sampleLine.slice(start - 1, start - 1 + length);
    return slice.trim() || "(boş)";
  }

  function furthestEnd(): number {
    const ends: number[] = [];
    for (const key of FIELD_ORDER) {
      const f = fieldPayload(key);
      if (f) ends.push(f.start + f.length - 1);
    }
    for (const b of subjectBlocks) {
      if (b.start && b.length) ends.push(b.start + b.length - 1);
    }
    return ends.length > 0 ? Math.max(...ends) : 0;
  }

  function addSubjectBlock() {
    const suggestedStart = furthestEnd() + 1;
    setSubjectBlocks((prev) => [...prev, { subject: "", start: suggestedStart, length: 0 }]);
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setSubjectBlocks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    if (!name.trim()) return showError("Şablon adı zorunludur.");
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
      const url = initial ? `/api/optical-formats/${initial.id}` : "/api/optical-formats";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Kaydedilemedi.");
      showSuccess("Optik şablon kaydedildi.");
      onSaved(data.format);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">Şablon Adı</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={lockName}
          placeholder="örn. Standart Optik Formatı"
          className="w-full rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-espresso outline-none focus:border-emerald-600 disabled:opacity-60 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] font-medium text-espresso-muted dark:text-cream/40">
          Örnek Satır <span className="font-normal opacity-70">(opsiyonel — girersen her alanın ne kestiğini canlı görürsün)</span>
        </label>
        <textarea
          value={sampleLine}
          onChange={(e) => setSampleLine(e.target.value.split(/\r?\n/)[0] ?? "")}
          placeholder="Optik dosyandan tek bir öğrenci satırını buraya yapıştır…"
          rows={2}
          className="w-full resize-y rounded-lg border border-hairline bg-white px-3 py-2 font-mono text-[10.5px] leading-relaxed text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
        />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold text-espresso dark:text-cream">Kimlik Alanları (Başlangıç / Uzunluk)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FIELD_ORDER.map((key) => {
            const f = fieldPayload(key);
            const previewText = f ? preview(f.start, f.length) : "";
            return (
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
                {sampleLine && (
                  <p className={cn("mt-1 truncate text-[10px] font-semibold", previewText ? "text-emerald-700 dark:text-emerald-300" : "text-espresso-muted/50 dark:text-cream/20")}>
                    → {previewText || "—"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-espresso dark:text-cream">
            Ders Blokları <span className="font-normal text-espresso-muted dark:text-cream/40">(sırası dosyadaki sırayla AYNI olmalı)</span>
          </p>
          <button
            onClick={addSubjectBlock}
            className="flex items-center gap-1 rounded-lg border border-hairline px-2 py-1 text-[10.5px] font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
          >
            <Plus className="h-3 w-3" /> Ders Ekle
          </button>
        </div>
        <div className="space-y-1.5">
          {subjectBlocks.map((block, i) => {
            const previewText = block.start && block.length ? preview(block.start, block.length) : "";
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-center text-[10px] font-semibold text-espresso-muted dark:text-cream/40">{i + 1}.</span>
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
                  placeholder="Soru say."
                  inputMode="numeric"
                  className="w-20 rounded-lg border border-hairline bg-white px-2 py-1.5 text-[11px] text-espresso outline-none focus:border-emerald-600 dark:border-white/10 dark:bg-midnight dark:text-cream"
                />
                <div className="flex shrink-0 flex-col">
                  <button onClick={() => moveBlock(i, -1)} disabled={i === 0} className="rounded p-0.5 text-espresso-muted transition hover:bg-cream-card disabled:opacity-20 dark:text-cream/40 dark:hover:bg-white/10">
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveBlock(i, 1)}
                    disabled={i === subjectBlocks.length - 1}
                    className="rounded p-0.5 text-espresso-muted transition hover:bg-cream-card disabled:opacity-20 dark:text-cream/40 dark:hover:bg-white/10"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={() => setSubjectBlocks((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-lg p-1.5 text-rose-500 transition hover:bg-rose-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {sampleLine && (
                  <span className={cn("w-24 shrink-0 truncate text-[10px] font-semibold", previewText ? "text-emerald-700 dark:text-emerald-300" : "text-espresso-muted/50 dark:text-cream/20")}>
                    → {previewText || "—"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
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
  );
}
