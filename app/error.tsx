"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { useRouter } from "next/navigation";

// Next.js App Router segment hata sınırı — bir sayfa render sırasında
// çökerse (beyaz ekran yerine) burası devreye girer. Layout.tsx'in kendisi
// çökerse bunun yerine app/global-error.tsx tetiklenir.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "route_render_error",
        error: error.message,
        digest: error.digest,
      })
    );
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center dark:bg-midnight">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
        <AlertTriangle className="h-8 w-8" />
      </span>
      <h1 className="text-lg font-semibold text-espresso dark:text-cream">Bir Şeyler Ters Gitse De Yanındayız</h1>
      <p className="max-w-sm text-sm text-espresso-muted dark:text-cream/40">
        Bu sayfada beklenmeyen bir hata oluştu. Tekrar deneyebilir ya da ana sayfaya dönebilirsin.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={reset}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-espresso px-4 text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <RotateCcw className="h-4 w-4" /> Tekrar Dene
        </button>
        <button
          onClick={() => router.push("/")}
          className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-hairline px-4 text-sm font-medium text-espresso transition hover:bg-cream-card dark:border-white/10 dark:text-cream dark:hover:bg-white/5"
        >
          <Home className="h-4 w-4" /> Ana Sayfa
        </button>
      </div>
    </div>
  );
}
