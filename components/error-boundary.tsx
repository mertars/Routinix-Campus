"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

type Props = { children: ReactNode };
type State = { hasError: boolean; message?: string };

// Alt ağaçtaki render/lifecycle hatalarını yakalayıp beyaz ekran yerine
// "Warm Cream & Deep Espresso" temasına uygun bir kurtarma ekranı gösterir.
// Not: Next.js App Router'da segment bazlı hatalar için ayrıca app/error.tsx
// ve app/global-error.tsx da var — bu bileşen daha küçük, iç içe alt
// ağaçları (örn. tek bir modül sekmesi) izole etmek için kullanılabilir.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : "Bilinmeyen hata" };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "client_render_error",
        error: error instanceof Error ? error.message : String(error),
        componentStack: info.componentStack,
      })
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h2 className="text-base font-semibold text-espresso dark:text-cream">Bir Şeyler Ters Gitse De Yanındayız</h2>
        <p className="max-w-sm text-sm text-espresso-muted dark:text-cream/40">
          Bu ekranda beklenmeyen bir hata oluştu. Sorun devam ederse sayfayı yenilemeyi deneyin.
        </p>
        <button
          onClick={this.handleReset}
          className="mt-2 flex min-h-[44px] items-center gap-1.5 rounded-xl bg-espresso px-4 text-sm font-semibold text-cream transition hover:bg-caramel dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <RotateCcw className="h-4 w-4" /> Tekrar Dene
        </button>
      </div>
    );
  }
}
