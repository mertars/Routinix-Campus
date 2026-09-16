"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Loader2, LogOut } from "lucide-react";

// GÖRÜNTÜLEME BANTI — "şu an başkasının panelindesiniz".
//
// ⚠️ NEDEN VAR: bir yöneticinin başka bir kullanıcının panelinde olduğunu
// UNUTMASI, bu özelliğin en gerçekçi riskidir. Bant her sayfada, en üstte
// ve kapatılamaz şekilde durur; çıkış tuşu her zaman bir tık uzaktadır.
//
// Bant ayrıca dürüst bir bilgi taşır: ekran SALT OKUNURDUR. Yönetici bir
// tuşa basıp "neden olmuyor" diye düşünmesin diye sebebi burada yazar.

type ViewState = { active: boolean; name: string; role: string; byName: string } | null;

const ROLE_LABEL: Record<string, string> = {
  STUDENT: "öğrenci",
  TEACHER: "öğretmen",
  PARENT: "veli",
  GUIDANCE: "rehberlik",
};

export function ImpersonationBanner({ initial }: { initial: ViewState }) {
  const router = useRouter();
  const [state] = useState<ViewState>(initial);
  const [leaving, setLeaving] = useState(false);

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
    setLeaving(true);
    try {
      const res = await fetch("/api/admin/impersonate", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      // Yönetici kendi paneline döner; router.refresh() sunucu bileşenlerinin
      // kimliği yeniden çözmesi için ŞART (cookie silindi ama RSC önbelleği
      // hâlâ görüntülenen kullanıcıyı taşıyor olabilir).
      window.location.href = data?.url ?? "/principal";
    } catch {
      setLeaving(false);
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[200] flex min-h-[40px] items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-center text-[12px] font-semibold text-amber-950 shadow-md">
      <Eye className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0">
        <span className="font-bold">{state.name}</span> adlı {ROLE_LABEL[state.role] ?? "kullanıcı"} hesabını
        görüntülüyorsunuz — <span className="font-bold">salt okunur</span>, değişiklik yapılamaz.
      </span>
      <button
        onClick={leave}
        disabled={leaving}
        className="ml-1 flex min-h-[28px] shrink-0 items-center gap-1 rounded-full bg-amber-950 px-2.5 text-[11px] font-bold text-amber-50 transition hover:bg-amber-900 disabled:opacity-60"
      >
        {leaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <LogOut className="h-3 w-3" />}
        Görüntülemeden Çık
      </button>
    </div>
  );
}
