import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { RoleProvider } from "@/lib/role-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AccentProvider } from "@/lib/accent-context";
import { LiveSyncProvider } from "@/lib/live-sync-context";
import { ToastProvider } from "@/lib/toast-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { PanelAurora } from "@/components/ui/aurora-brand";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routinix Kampüs",
  description: "Dershane & Okul Yönetim Paneli",
};

// viewportFit: "cover" — mobil Safari'de (çentikli/Dynamic Island'lı
// cihazlar) içeriğin güvenli alanın DIŞINA, tam ekrana yayılmasını sağlar;
// globals.css'teki env(safe-area-inset-*) dolgularıyla birlikte çalışır.
// ⚠️ theme-color BİLEREK burada (Next'in viewport.themeColor medya-sorgulu
// dizisiyle) DEĞİL, aşağıda TEK bir <meta> etiketi olarak elle yazılıyor:
// medya-sorgulu iki ayrı etiket OS tercihini takip eder, ama bu uygulamanın
// teması OS'tan BAĞIMSIZ elle değiştirilebiliyor (bkz. lib/theme-context.tsx)
// — kullanıcı OS light iken uygulamayı elle dark yaparsa, medya-sorgulu
// yaklaşımda "dark" etiketi hiç eşleşmediği için tarayıcı kromu yanlış
// kalırdı. Tek etiket + JS senkronizasyonu bu çelişkiyi ortadan kaldırır.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("routinix-kampus-theme");
    var isDark = stored === "dark";
    if (isDark) document.documentElement.classList.add("dark");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#12100D" : "#FDFBF7");
  } catch (e) {}
})();
`;

const ACCENT_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("routinix-kampus-accent");
    if (!stored) return;
    var parsed = JSON.parse(stored);
    var ramp = parsed.ramp;
    var root = document.documentElement.style;
    for (var shade in ramp) {
      if (Object.prototype.hasOwnProperty.call(ramp, shade)) {
        root.setProperty("--brand-" + shade, ramp[shade]);
      }
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  // middleware.ts'in her istekte ürettiği CSP nonce'ı — Next.js kendi
  // hydration/RSC script'lerine bunu otomatik uygular, ama BURADA elle
  // yazılan iki inline script'in çalışabilmesi için nonce prop'u AÇIKÇA
  // gerekir (aksi halde script-src CSP'si tarafından sessizce engellenir).
  const nonce = headers().get("x-nonce") ?? undefined;

  return (
    <html lang="tr">
      <head>
        {/* Varsayılan (light) — SSR her zaman "light" state'iyle başlar (bkz.
            lib/theme-context.tsx), THEME_INIT_SCRIPT hydration'dan ÖNCE
            gerçek değere düzeltir; sonraki elle tema değişimlerini de AYNI
            ThemeProvider effect'i senkronize tutar. */}
        <meta name="theme-color" content="#FDFBF7" />
        {/* Hydration'dan önce çalışır — dark mod / özel vurgu rengi tercihi varsa
            flash (varsayılan görünümün bir anlığına yanıp sönmesi) olmadan
            doğrudan uygulanır. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: ACCENT_INIT_SCRIPT }} />
      </head>
      <body className="overflow-x-hidden bg-cream text-espresso dark:bg-midnight dark:text-cream">
        <PanelAurora />
        <ThemeProvider>
          <AccentProvider>
            <RoleProvider>
              <LiveSyncProvider>
                <ToastProvider>
                  <ErrorBoundary>{children}</ErrorBoundary>
                </ToastProvider>
              </LiveSyncProvider>
            </RoleProvider>
          </AccentProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
