"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Kök layout.tsx'in KENDİSİ çökerse devreye giren son çare — bu yüzden
// kendi <html>/<body>'sini içermek zorunda (o an aktif layout tamamen
// devre dışı kalmış olur).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "root_layout_render_error",
        error: error.message,
        digest: error.digest,
      })
    );
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ background: "#FDFBF7", color: "#2C221E", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center" }}>
          <span style={{ display: "flex", height: 64, width: 64, alignItems: "center", justifyContent: "center", borderRadius: 16, background: "#FEE2E2", color: "#DC2626" }}>
            <AlertTriangle size={32} />
          </span>
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Bir Şeyler Ters Gitse De Yanındayız</h1>
          <p style={{ maxWidth: 380, fontSize: 14, color: "#786C66" }}>
            Uygulama beklenmeyen bir hatayla karşılaştı. Sayfayı yenilemeyi deneyin.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, borderRadius: 12, background: "#2C221E", color: "#FDFBF7", padding: "10px 18px", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
          >
            <RotateCcw size={16} /> Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
