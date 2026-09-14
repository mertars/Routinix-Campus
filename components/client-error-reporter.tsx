"use client";

import { useEffect } from "react";

// TARAYICI HATALARINI SUNUCUYA BİLDİRİR.
//
// ⚠️ Yakaladığı üç şeyin hepsi bu projede GERÇEKTEN yaşandı:
//  1. `securitypolicyviolation` — R2'ye taşınan fotoğraflar CSP'ye
//     takılıp SESSİZCE engellendi (2026-09-14). Ne ağ hatası ne log vardı.
//  2. `error` — yakalanmamış JS hatası (beyaz ekran).
//  3. `unhandledrejection` — başarısız fetch/Promise (butonun "hiçbir şey
//     yapmaması" genelde budur).
//
// Gönderim toplu ve kısıtlı: aynı hata tekrar tekrar gönderilmez, sayfa
// başına üst sınır vardır — hata döngüsü sunucuyu boğmamalı.

const MAX_PER_PAGE = 10;
const FLUSH_MS = 3_000;

type Payload = { kind: string; message: string; source?: string; stack?: string; url: string };

export function ClientErrorReporter() {
  useEffect(() => {
    const queue: Payload[] = [];
    const seen = new Set<string>();
    let sent = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function push(p: Payload) {
      const key = `${p.kind}|${p.message}|${p.source ?? ""}`;
      if (seen.has(key) || sent >= MAX_PER_PAGE) return;
      seen.add(key);
      sent += 1;
      queue.push(p);
      if (!timer) timer = setTimeout(flush, FLUSH_MS);
    }

    function flush() {
      timer = null;
      if (queue.length === 0) return;
      const errors = queue.splice(0, queue.length);
      // keepalive: sayfa kapanırken bile gitsin.
      void fetch("/api/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ errors }),
        keepalive: true,
      }).catch(() => {});
    }

    function onCsp(event: SecurityPolicyViolationEvent) {
      push({
        kind: "csp",
        message: `CSP ihlali: ${event.violatedDirective} engelledi`,
        source: event.blockedURI,
        url: location.href,
      });
    }
    function onError(event: ErrorEvent) {
      push({
        kind: "error",
        message: event.message,
        source: event.filename,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        url: location.href,
      });
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      push({
        kind: "unhandledrejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        url: location.href,
      });
    }

    document.addEventListener("securitypolicyviolation", onCsp);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.addEventListener("pagehide", flush);

    return () => {
      document.removeEventListener("securitypolicyviolation", onCsp);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return null;
}
