import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireSession } from "@/lib/server/auth/session-guard";

export const dynamic = "force-dynamic";

// POST /api/client-errors — TARAYICIDA oluşan hataların sunucu loguna düşmesi.
//
// ⚠️ NEDEN VAR: 2026-09-14'te fotoğraflar R2'ye taşındıktan sonra tarayıcı
// onları CSP ihlali sayıp SESSİZCE engelledi. Sunucu logunda hiçbir iz yoktu,
// ağ hatası bile yoktu — hatayı ancak Mert "fotoğraf görünmüyor" dediğinde
// öğrendik. 500 dershaneye çıkarken bu kabul edilemez: sistemin hatayı
// müşteriden ÖNCE söylemesi gerekir.
//
// Dış bir servise (Sentry vb.) bağımlılık BİLEREK yok — kullanıcı kararı:
// "dışarıya bağımlılık minimum". Hatalar mevcut logger'a yazılır.

/** Tek bir tarayıcıdan gelebilecek azami kayıt — log taşmasını önler. */
const MAX_BATCH = 10;
const MAX_LEN = 1_000;

function clip(value: unknown, max = MAX_LEN): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

async function handlePost(request: NextRequest) {
  // Oturum yoksa da kabul edilir (login ekranındaki hata da değerlidir),
  // ama kim olduğunu biliyorsak logda dursun.
  let actor: string | null = null;
  let institutionId: string | null = null;
  try {
    const session = await requireSession();
    actor = `${session.role}:${session.sub}`;
    institutionId = session.institutionId;
  } catch {
    // anonim — sorun değil
  }

  try {
    const body = (await request.json().catch(() => null)) as { errors?: unknown } | null;
    const list = Array.isArray(body?.errors) ? body.errors.slice(0, MAX_BATCH) : [];
    if (list.length === 0) return NextResponse.json({ ok: true, received: 0 });

    for (const raw of list) {
      const e = (raw ?? {}) as Record<string, unknown>;
      logger.error("client_error", {
        kind: clip(e.kind, 40) || "error",
        message: clip(e.message),
        source: clip(e.source, 300),
        stack: clip(e.stack, 2_000),
        url: clip(e.url, 300),
        actor,
        institutionId,
      });
    }
    return NextResponse.json({ ok: true, received: list.length });
  } catch {
    // Hata bildirimi kendisi hata vermemeli.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export const POST = handlePost;
