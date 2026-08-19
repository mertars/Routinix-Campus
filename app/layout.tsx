import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RoleProvider } from "@/lib/role-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AccentProvider } from "@/lib/accent-context";
import { LiveSyncProvider } from "@/lib/live-sync-context";
import { ToastProvider } from "@/lib/toast-context";
import { ErrorBoundary } from "@/components/error-boundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "Routinix Kampüs",
  description: "Dershane & Okul Yönetim Paneli",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("routinix-kampus-theme");
    if (stored === "dark") document.documentElement.classList.add("dark");
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
  return (
    <html lang="tr">
      <head>
        {/* Hydration'dan önce çalışır — dark mod / özel vurgu rengi tercihi varsa
            flash (varsayılan görünümün bir anlığına yanıp sönmesi) olmadan
            doğrudan uygulanır. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ACCENT_INIT_SCRIPT }} />
      </head>
      <body className="overflow-x-hidden bg-cream text-espresso dark:bg-midnight dark:text-cream">
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
