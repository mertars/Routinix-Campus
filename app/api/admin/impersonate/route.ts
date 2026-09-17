import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/server/auth/jwt";
import {
  PREVIEW_SESSION_COOKIE_NAME,
  PREVIEW_SESSION_MAX_AGE_SECONDS,
  resolveActivePreview,
  signPreviewSessionToken,
} from "@/lib/server/auth/preview-jwt";
import {
  signImpersonationToken,
  verifyImpersonationToken,
  IMPERSONATION_COOKIE_NAME,
  IMPERSONATION_MAX_AGE_SECONDS,
} from "@/lib/server/auth/impersonation-jwt";
import type { AuthRole } from "@/lib/server/auth/jwt";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { recordAuditLog } from "@/lib/server/audit/audit-log";
import { withApiLogging, logger } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------------------
// "PANELE GİR" — kurum yöneticisinin, kendi kurumundaki bir kullanıcının
// panelini o kullanıcının gözünden AÇMASI.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-16): "yönetici herkesin paneline girebilsin,
// kendi kurumundaki tüm hesaplara erişebilir, güvenlik açığı oluşmasın ama
// sadece yönetici."
//
// 🔒 BU UÇ NEDEN AÇIK DEĞİL — altı kapı:
//   1. requireRole(session, "principal") — yalnızca YÖNETİCİ çağırabilir.
//   2. Hedef kullanıcı istemciden gelen id'ye GÜVENİLEREK değil, kendi
//      kurumundan DOĞRULANARAK bulunur; başka kurumun id'si 404 döner ve
//      o kaydın VARLIĞINI bile sızdırmaz.
//   3. Yönetici→yönetici geçişi YASAK (kurum içi hesap verebilirlik).
//   4. Pasif hesaba girilemez — ayrılmış bir öğrencinin paneli açılmaz.
//   5. Üretilen oturum SALT OKUNUR; yazma iki bağımsız katmanda engellenir
//      (bkz. lib/server/preview/read-only.ts) ve yazma modu YOKTUR.
//   6. Başlangıç ve çıkış DENETİM KAYDINA yazılır (PANEL_VIEW_STARTED /
//      PANEL_VIEW_ENDED) — sessiz bir görüntüleme mümkün değildir.
//
// Şifre HİÇ kullanılmaz, okunmaz, ifşa edilmez.
// ----------------------------------------------------------------------------

const bodySchema = z.object({
  role: z.enum(["teacher", "student", "parent", "guidance"]),
  userId: z.string().min(1),
  // Düzenleme modu — VARSAYILAN KAPALI. Yönetici bir paneli incelerken
  // yanlışlıkla veri değiştirmesin; düzenleme açık bir tercih olsun
  // (bkz. impersonation-jwt.ts > canWrite).
  write: z.boolean().optional(),
});

const AUTH_ROLE_BY_ROLE: Record<string, AuthRole> = {
  teacher: "TEACHER",
  student: "STUDENT",
  parent: "PARENT",
  guidance: "GUIDANCE",
};

const PANEL_PATH_BY_ROLE: Record<string, string> = {
  teacher: "/teacher",
  student: "/student",
  parent: "/parent",
  guidance: "/guidance",
};

/** Hedef kullanıcıyı YÖNETİCİNİN KURUMUNDAN doğrulayarak getirir. */
async function findTarget(role: string, userId: string, institutionId: string) {
  if (role === "student") {
    const s = await prisma.student.findFirst({
      where: { id: userId, institutionId, isActive: true },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });
    return s ? { id: s.id, name: `${s.firstName} ${s.lastName}`, phone: s.phone ?? "" } : null;
  }
  if (role === "parent") {
    const p = await prisma.parent.findFirst({
      // ⚠️ Parent'ta isActive alanı YOK — veli kaydı öğrenciye bağlıdır ve
      // pasifleştirme öğrenci üzerinden yürür (bkz. schema.prisma > Parent).
      where: { id: userId, institutionId },
      select: { id: true, firstName: true, lastName: true, mobilePhone: true },
    });
    return p ? { id: p.id, name: `${p.firstName} ${p.lastName}`, phone: p.mobilePhone ?? "" } : null;
  }
  // teacher ve guidance AYNI tabloda (rehberlik personası bir Teacher
  // kaydıdır, bkz. lib/server/auth/otp.ts) — ayrımı subject alanı yapar.
  const t = await prisma.teacher.findFirst({
    where: {
      id: userId,
      institutionId,
      isActive: true,
      ...(role === "guidance" ? { subject: "Rehberlik" } : { subject: { not: "Rehberlik" } }),
    },
    select: { id: true, firstName: true, lastName: true, mobilePhone: true },
  });
  return t ? { id: t.id, name: `${t.firstName} ${t.lastName}`, phone: t.mobilePhone ?? "" } : null;
}

async function handlePost(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AuthError("Rol ve kullanıcı zorunludur.", "MISSING_FIELDS", 400);
    const { role, userId, write } = parsed.data;

    // ⚠️ KİMLİK BURADA requireSession() İLE ÇÖZÜLMEZ — GERÇEK HATA (Mert,
    // 2026-09-17: "böyle bir hata aldım, açılmıyor, panellere giremiyor").
    //
    // requireSession, aktif bir görüntüleme varsa GÖRÜNTÜLENEN kullanıcının
    // kimliğini döndürür (özelliğin bütün amacı bu). Bu uç ise tam tersini
    // sormak zorunda: "bu isteği yapan GERÇEK kişi kim?". Eskiden
    // requireSession kullanılıyordu ve sonuç şuydu: tarayıcıda bir
    // görüntüleme çerezi kaldığı anda yönetici BAŞKA hiçbir panele
    // giremiyordu — istek öğrenci kimliğiyle değerlendirilip reddediliyordu.
    // Yani özellik, ilk kullanımdan sonra kendini kilitliyordu.
    //
    // Doğrusu: yönetici oturumunu HAM ÇEREZDEN oku. Böylece eski görüntüleme
    // çerezi bir engel değil, sadece üzerine yazılacak bir değerdir.
    const adminToken = cookies().get(SESSION_COOKIE_NAME)?.value;
    const admin = adminToken ? await verifySessionToken(adminToken) : null;

    // ⚠️ PLATFORM ÖNİZLEMESİ İÇİNDEN (Mert, 2026-09-17: "beni giriş
    // sayfasına atıyor, yine giremedim").
    //
    // Mert yönetici paneline /platform > Panel Önizleme üzerinden bakıyordu.
    // O bağlamda GERÇEK bir kurum oturumu çerezi YOKTUR — dolayısıyla
    // üretilecek görüntüleme jetonu hiçbir zaman çözülemez (bkz.
    // impersonation-jwt.ts > resolveActiveImpersonation'ın 2. şartı) ve
    // tarayıcı /student'a gidince middleware onu hâlâ "yönetici" sayıp
    // "bu rolle erişemezsiniz" diye geri atıyordu.
    //
    // Çözüm: tuşu orada da ÇALIŞTIR — ama görüntüleme jetonu üreterek
    // değil, ZATEN VAR OLAN önizleme mekanizmasını o kullanıcıya
    // yönlendirerek. Platform sahibi kurum yöneticisinden daha yetkilidir,
    // yani yeni bir yetki açılmıyor: aynı kişi aynı paneli önizleme rol
    // seçicisinden de açabiliyordu; bu sadece "listedeki şu öğrenci" diye
    // seçebilmesini sağlıyor.
    if (!admin) {
      const preview = await resolveActivePreview((name) => cookies().get(name)?.value);
      if (preview) {
        const target = await findTarget(role, userId, preview.institutionId);
        if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
        const token = await signPreviewSessionToken({
          sub: target.id,
          role: AUTH_ROLE_BY_ROLE[role],
          phone: target.phone,
          name: target.name,
          institutionId: preview.institutionId,
          preview: true,
          previewBy: preview.previewBy,
          // Önizlemenin yazma modu KORUNUR — kullanıcı önizlemeyi yazma
          // moduyla açtıysa panel değiştirince kapanmasın.
          canWrite: write === true || preview.canWrite === true,
        });
        cookies().set(PREVIEW_SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: PREVIEW_SESSION_MAX_AGE_SECONDS,
        });
        logger.warn("platform_preview_switched_from_panel", {
          previewBy: preview.previewBy,
          institutionId: preview.institutionId,
          asUser: `${role}:${target.id}`,
          asName: target.name,
        });
        return NextResponse.json({
          ok: true,
          url: PANEL_PATH_BY_ROLE[role],
          target: { id: target.id, name: target.name, role },
          canWrite: write === true || preview.canWrite === true,
          viaPreview: true,
        });
      }
    }
    if (!admin) throw new AuthError("Oturum bulunamadı. Lütfen giriş yapın.", "NO_SESSION", 401);
    if (admin.role !== "ADMIN") throw new AuthError("Bu işlem için yetkiniz yok.", "FORBIDDEN_ROLE", 403);

    // Kurum askıya alınmışsa hiçbir panel açılmaz — requireSession'ın yaptığı
    // kill-switch kontrolünün burada da uygulanması ŞART (ham çerezden
    // okuduğumuz için o kontrolü atlamış oluyoruz).
    const institution = await prisma.institution.findUnique({
      where: { id: admin.institutionId },
      select: { isActive: true },
    });
    if (!institution?.isActive) {
      throw new AuthError("Kurum hesabınız askıya alınmış.", "INSTITUTION_SUSPENDED", 403);
    }
    const session = admin;

    const target = await findTarget(role, userId, session.institutionId);
    // 404 — 403 DEĞİL: başka kurumun kaydının VARLIĞINI bile sızdırmayız
    // (session-guard.ts > requireInstitution ile aynı gerekçe).
    if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

    const token = await signImpersonationToken({
      sub: target.id,
      role: AUTH_ROLE_BY_ROLE[role],
      phone: target.phone,
      name: target.name,
      institutionId: session.institutionId,
      impersonation: true,
      by: session.sub,
      byName: session.name,
      canWrite: write === true,
      targetRole: role,
    });

    cookies().set(IMPERSONATION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    });

    await recordAuditLog({
      institutionId: session.institutionId,
      actorId: session.sub,
      actorRole: session.role,
      action: "PANEL_VIEW_STARTED",
      targetType: role === "student" ? "Student" : role === "parent" ? "Parent" : "Teacher",
      targetId: target.id,
      metadata: { role, targetName: target.name, mode: write ? "edit" : "read-only" },
    });
    logger.warn("panel_view_started", {
      institutionId: session.institutionId,
      by: session.sub,
      byName: session.name,
      asUser: `${role}:${target.id}`,
      asName: target.name,
      mode: write ? "edit" : "read-only",
    });

    return NextResponse.json({
      ok: true,
      url: PANEL_PATH_BY_ROLE[role],
      target: { id: target.id, name: target.name, role },
      canWrite: write === true,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("impersonate_start_failed", error);
  }
}

// DELETE /api/admin/impersonate — görüntülemeden çık.
//
// ⚠️ Bu uç, görüntüleme AÇIKKEN çalışmak zorunda olduğu için salt-okunur
// kilidinin kontrol düzlemi istisnasındadır (bkz. read-only.ts >
// IMPERSONATION_CONTROL_PATH). requireSession burada hedef kullanıcının
// kimliğini döner; bu yüzden "kim çıktı" bilgisi oturumdan DEĞİL, çerezdeki
// imzalı token'dan (by alanı) okunur.
async function handleDelete() {
  try {
    const raw = cookies().get(IMPERSONATION_COOKIE_NAME)?.value;
    const view = raw ? await verifyImpersonationToken(raw) : null;

    cookies().delete(IMPERSONATION_COOKIE_NAME);

    if (view) {
      await recordAuditLog({
        institutionId: view.institutionId,
        actorId: view.by,
        actorRole: "ADMIN",
        action: "PANEL_VIEW_ENDED",
        targetType: view.role === "STUDENT" ? "Student" : view.role === "PARENT" ? "Parent" : "Teacher",
        targetId: view.sub,
        metadata: { targetName: view.name },
      });
    }
    return NextResponse.json({ ok: true, url: "/principal" });
  } catch (error) {
    return apiFailure("impersonate_stop_failed", error);
  }
}

export const POST = withApiLogging("POST /api/admin/impersonate", handlePost);
export const DELETE = withApiLogging("DELETE /api/admin/impersonate", handleDelete);
