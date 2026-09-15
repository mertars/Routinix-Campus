import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import {
  signPreviewSessionToken,
  verifyPreviewSessionToken,
  PREVIEW_SESSION_COOKIE_NAME,
  PREVIEW_SESSION_MAX_AGE_SECONDS,
} from "@/lib/server/auth/preview-jwt";
import {
  listPreviewTargets,
  AUTH_ROLE_BY_PREVIEW_ROLE,
  PANEL_PATH_BY_ROLE,
  PREVIEW_ROLES,
  ROLE_LABEL,
} from "@/lib/server/platform/preview-targets";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import type { RoleId } from "@/lib/server/auth/jwt";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------------------
// PANEL ÖNİZLEMESİ — platform sahibinin bir kurumun panelini kendi
// tarayıcısında, GERÇEK bir kullanıcının gözünden açması.
//
// Neden var (Mert, 2026-09-15): beş panelin gerçek görünümünü denetlemek
// için üç ayrı tarayıcıda üç ayrı hesapla giriş yapmak gerekiyordu; aynı
// tarayıcıda ikinci bir hesaba girmek birincisinden atıyordu. Bu uç, o
// döngüyü tek tıkla değiştirir ve önizleme GERÇEK rotaları gösterdiği için
// her zaman canlı sürümdür — ayrıca yenilenmesi gereken bir kopya YOKTUR.
//
// 🔒 GÜVENLİK — bu ucun neden bir açık OLMADIĞI:
//   * Üretmeye SADECE platform sahibi yetkili (requirePlatformSession).
//     Kurum kullanıcısının kendisi için önizleme üretmesinin yolu yok.
//   * Üretilen token SALT OKUNUR — yazma iki bağımsız katmanda engellenir
//     (bkz. lib/server/preview/read-only.ts).
//   * Token GERÇEK bir oturumun yerine geçemez: kurum oturumu cookie'si
//     varsa önizleme hiç okunmaz (session-guard/middleware/read-only, üçü de).
//   * Ayrı 'aud' claim'i — kurum veya platform oturumu olarak kullanılamaz.
//   * 1 saat ömür; kapatınca, platform çıkışında ve /platform açılışında silinir.
//   * Şifre okunmaz/ifşa edilmez; hedef kullanıcının şifresi hiç kullanılmaz.
// ----------------------------------------------------------------------------

const bodySchema = z.object({
  institutionId: z.string().min(1),
  role: z.enum(["principal", "teacher", "student", "parent", "guidance"]),
  // Belirtilmezse o rolün ilk (varsayılan) kullanıcısı seçilir.
  userId: z.string().min(1).optional(),
});

async function handlePost(request: NextRequest) {
  try {
    const owner = await requirePlatformSession();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AuthError("Kurum ve rol zorunludur.", "MISSING_FIELDS", 400);
    }
    const { institutionId, role, userId } = parsed.data;
    const institution = await requirePlatformInstitution(institutionId);

    // ⚠️ Hedef kullanıcı client'tan gelen id'ye GÜVENİLEREK değil, kurumun
    // kendi listesinden DOĞRULANARAK seçilir — istemci başka bir kurumun
    // kullanıcı id'sini göndererek kurumlar arası bir kimlik üretemez.
    const targets = await listPreviewTargets(institutionId, role as RoleId);
    const target = userId ? targets.find((t) => t.id === userId) : targets[0];
    if (!target) {
      return NextResponse.json(
        { error: `${institution.name} kurumunda önizlenebilecek bir ${ROLE_LABEL[role as RoleId]} hesabı yok.`, code: "NO_TARGET" },
        { status: 404 }
      );
    }

    const token = await signPreviewSessionToken({
      sub: target.id,
      role: AUTH_ROLE_BY_PREVIEW_ROLE[role as RoleId],
      phone: target.phone,
      name: target.name,
      institutionId,
      preview: true,
      previewBy: owner.sub,
    });

    // DENETİM İZİ — kimlik bürünme her zaman iz bırakmalı. AuditLog'a
    // yazılmıyor: bu, şemaya yeni bir AuditAction değeri (dolayısıyla bir
    // migration) gerektirirdi ve bu özellik veritabanı şemasına hiç
    // dokunmadan tamamlanacak şekilde tasarlandı. Sunucu logu Sentry'ye de
    // akıyor (bkz. lib/logger.ts) — "kim, hangi kuruma, hangi rolle baktı"
    // sorusunun cevabı orada aranabilir durumda.
    logger.warn("platform_preview_started", {
      previewBy: owner.sub,
      previewByName: owner.name,
      institutionId,
      institutionName: institution.name,
      role,
      targetId: target.id,
      targetName: target.name,
    });

    const response = NextResponse.json({
      ok: true,
      url: PANEL_PATH_BY_ROLE[role as RoleId],
      institutionName: institution.name,
      role,
      roleLabel: ROLE_LABEL[role as RoleId],
      user: { id: target.id, name: target.name, detail: target.detail },
      expiresInSeconds: PREVIEW_SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set(PREVIEW_SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: PREVIEW_SESSION_MAX_AGE_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("platform_preview_start_failed", error);
  }
}

// Önizlemeden çıkış. /platform panosu AÇILIŞTA da bunu çağırır (fikir
// birliği: unutulmuş bir önizleme cookie'si platform konsolunu kısıtlamasın)
// — bu yüzden oturum yokken bile hata vermez, sadece cookie'yi siler.
async function handleDelete() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(PREVIEW_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}

// GET — o anda açık bir önizleme var mı? (Sayfa yenilenince arayüz kendini
// toparlayabilsin diye; cookie httpOnly olduğu için JS okuyamaz.)
async function handleGet() {
  try {
    await requirePlatformSession();
    const raw = cookies().get(PREVIEW_SESSION_COOKIE_NAME)?.value;
    if (!raw) return NextResponse.json({ active: false });
    const preview = await verifyPreviewSessionToken(raw);
    if (!preview) return NextResponse.json({ active: false });
    return NextResponse.json({
      active: true,
      institutionId: preview.institutionId,
      role: PREVIEW_ROLES.find((r) => AUTH_ROLE_BY_PREVIEW_ROLE[r] === preview.role) ?? null,
      user: { id: preview.sub, name: preview.name },
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("platform_preview_status_failed", error);
  }
}

export const POST = withApiLogging("POST /api/platform/preview", handlePost);
export const DELETE = withApiLogging("DELETE /api/platform/preview", handleDelete);
export const GET = withApiLogging("GET /api/platform/preview", handleGet);
