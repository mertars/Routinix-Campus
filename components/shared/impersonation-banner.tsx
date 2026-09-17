"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, LogOut, Pencil, ShieldAlert } from "lucide-react";
import { enterPanel } from "@/lib/client/enter-panel";
import { cn } from "@/lib/utils";

// GÖRÜNTÜLEME/DÜZENLEME BANTI — "şu an başkasının panelindesiniz".
//
// ⚠️ NEDEN VAR: bir yöneticinin başka bir kullanıcının panelinde olduğunu
// UNUTMASI bu özelliğin en gerçekçi riskidir. Bant her sayfada, en üstte
// ve kapatılamaz şekilde durur; çıkış her zaman bir tık uzaktadır.
//
// ⚠️ İKİ MOD, İKİ RENK (Mert, 2026-09-17):
//   * AMBER  = görüntüleme (salt okunur) — varsayılan.
//   * KIRMIZI = düzenleme — yapılan HER değişiklik "yönetici tarafından,
//     X'in panelinden" olarak kayda geçer (ActivityLog). Rengin sertleşmesi
//     bilinçli: yönetici veri değiştirebildiği anı gözden kaçırmamalı.

type ViewState = {
  active: boolean;
  name: string;
  role: string;
  byName: string;
  canWrite: boolean;
  targetId: string;
  targetRole: "teacher" | "student" | "parent" | "guidance";
} | null;

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "öğrenci",
  TEACHER: "öğretmen",
  PARENT: "veli",
  GUIDANCE: "rehberlik",
};

export function ImpersonationBanner({ initial }: { initial: ViewState }) {
  const [state] = useState<ViewState>(initial);
  const [busy, setBusy] = useState<"leave" | "mode" | null>(null);

  // Bant varken sayfanın üstüne yer aç — sabit konumlu bant içeriği
  // örtmesin (panellerin kendi üst barları da sticky).
  useEffect(() => {
    if (!state?.active) return;
    document.body.style.paddingTop = "40px";
    return () => {
      document.body.style.paddingTop = "";
    };
  }, [state?.active]);

  if (!state?.active) return null;

  async function leave() {
    setBusy("leave");
    try {
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      // Tam sayfa yükleme ŞART: kimlik sunucuda değişti, istemcideki RSC
      // önbelleği hâlâ görüntülenen kullanıcının ağacını taşıyor olabilir.
      window.location.href = data?.url ?? "/principal";
    } catch {
      setBusy(null);
    }
  }

  async function toggleMode() {
    if (!state) return;
    setBusy("mode");
    // Aynı hedef, ters mod — çerez yeniden üretilir, sayfada kalınır.
    const error = await enterPanel(state.targetRole, state.targetId, { write: !state.canWrite, reload: false });
    if (error) setBusy(null);
  }

  const editing = state.canWrite;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[200] flex min-h-[40px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-3 py-1.5 text-center text-[12px] font-semibold shadow-md",
        editing ? "bg-red-600 text-white" : "bg-amber-500 text-amber-950"
      )}
    >
      {editing ? <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> : <Eye className="h-3.5 w-3.5 shrink-0" />}
      <span className="min-w-0">
        <span className="font-bold">{state.name}</span> adlı {ROLE_LABEL[state.role] ?? "kullanıcı"} hesabındasınız —{" "}
        {editing ? (
          <>
            <span className="font-bold underline">düzenleme açık</span>; yaptığınız her değişiklik{" "}
            <span className="font-bold">yönetici ({state.byName}) tarafından</span> yapıldı olarak kaydedilir.
          </>
        ) : (
          <>
            <span className="font-bold">salt okunur</span>, değişiklik yapılamaz.
          </>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={toggleMode}
          disabled={busy !== null}
          className={cn(
            "flex min-h-[28px] items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition disabled:opacity-60",
            editing ? "bg-white/20 text-white hover:bg-white/30" : "bg-amber-950/10 text-amber-950 hover:bg-amber-950/20"
          )}
        >
          {busy === "mode" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pencil className="h-3 w-3" />}
          {editing ? "Salt Okunura Dön" : "Düzenlemeyi Aç"}
        </button>
        <button
          onClick={leave}
          disabled={busy !== null}
          className={cn(
            "flex min-h-[28px] items-center gap-1 rounded-full px-2.5 text-[11px] font-bold transition disabled:opacity-60",
            editing ? "bg-white text-red-700 hover:bg-red-50" : "bg-amber-950 text-amber-50 hover:bg-amber-900"
          )}
        >
          {busy === "leave" ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
          Çık
        </button>
      </span>
    </div>
  );
}
