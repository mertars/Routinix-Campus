import { NextRequest, NextResponse } from "next/server";
import { getObjectStream } from "@/lib/server/r2";
import { requireSession } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// GET /api/files/<r2-anahtarı> — soru/materyal/gider eki dosyalarını KENDİ
// alan adımızdan sunar (R2'den okuyup akıtarak).
//
// ⚠️ NEDEN BÖYLE: dosyalar önce R2'nin herkese açık adresinden
// (pub-xxx.r2.dev) veriliyordu ve Mert'te HİÇ görünmedi. İki ayrı sorun
// üst üste bindi: (1) tarayıcı CSP'si o alan adına izin vermiyordu
// (düzeltildi), (2) kovanın herkese açık erişimi Cloudflare panelinde
// açık olmayabilir — bunu buradan doğrulayamıyoruz.
//
// Bu uç ikisini de gereksiz kılar:
//   * Aynı origin → CSP'nin `img-src 'self'` kuralına zaten uyar, hiçbir
//     dış alan adına izin vermeye gerek kalmaz.
//   * R2'nin herkese açık erişimi KAPALI olsa bile çalışır (okuma,
//     kimlik doğrulamalı S3 API'siyle yapılır).
//   * Dosyalar artık herkese açık değil: oturum yoksa 401.
//
// Bedeli: trafik kendi sunucumuzdan geçer. Soru fotoğrafları için kabul
// edilebilir; büyük video dosyaları ZATEN YouTube'da (bkz. lib/server/r2.ts).

/** Sadece bu ön ekler sunulur — kovadaki başka bir şeye erişim yok. */
const ALLOWED_PREFIXES = ["questions/", "materials/", "expenses/"];

async function handleGet(_request: NextRequest, { params }: { params: { key: string[] } }) {
  try {
    // Dosyalar kimliği doğrulanmış kullanıcılara açık. Kurum içi bir soru
    // fotoğrafının kurum dışına sızmaması için asgari koşul bu.
    await requireSession();

    const key = (params.key ?? []).join("/");
    // Yol gezinme (..) ve izinsiz ön ek koruması.
    if (!key || key.includes("..") || !ALLOWED_PREFIXES.some((p) => key.startsWith(p))) {
      return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
    }

    const object = await getObjectStream(key);
    return new NextResponse(object.body, {
      headers: {
        "Content-Type": object.contentType,
        ...(object.contentLength ? { "Content-Length": String(object.contentLength) } : {}),
        // Dosya adları rastgele UUID; içerik asla değişmez, uzun süre
        // önbelleğe alınabilir. `private`: paylaşılan bir CDN'de değil,
        // yalnızca kullanıcının tarayıcısında saklanır.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.warn("file_serve_failed", {
      key: (params.key ?? []).join("/"),
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 404 });
  }
}

export const GET = handleGet;
