import { prisma } from "@/lib/server/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/server/auth/jwt";
import { verifyImpersonationToken, IMPERSONATION_COOKIE_NAME } from "@/lib/server/auth/impersonation-jwt";
import { describeAdminAction } from "@/lib/server/activity/describe";

// ETKİNLİK KAYDI YAZICISI — tek noktadan, her yazma isteği için.
//
// ⚠️ NEDEN BURADA (Mert, 2026-09-17): "her öğretmenin/yöneticinin bütün
// veri giriş ve çıkışlarını rapor alabilmek istiyorum." Bunu uç uca
// eklemek 270 rotaya ayrı kod yazmak demekti ve yeni bir uç eklendiğinde
// unutulurdu. withApiLogging zaten TÜM rotaları sarmaladığı için kaydın
// doğal ve tek yeri orası.
//
// ⚠️ SADECE YÖNETİCİNİN EYLEMLERİ KAYDEDİLİR (Mert, 2026-09-17: "zaten
// yönetici yapmadıysa kişi kendi yapmıştır, başka seçenek yok"). Bir
// öğretmenin kaydını değiştirebilecek iki kişi vardır: kendisi ve
// yönetici. Yöneticinin eylemleri kayıtlıysa geri kalan her şey tanım
// gereği kişinin kendisine aittir. Bu, tabloyu hem küçük hem OKUNUR
// tutar — herkesin her isteğini tutmak günde on binlerce anlamsız satır
// demekti.
//
// ⚠️ KİMLİK ÇEREZDEKİ İMZALI JWT'DEN okunur, veritabanından değil — her
// yazma isteğine fazladan bir SELECT eklemek, bu turda düzelttiğimiz
// gecikme sorununu geri getirirdi. İsim/rol zaten token'ın içinde.
//
// ⚠️ İSTEK GÖVDESİ handler'dan ÖNCE okunup buraya hazır verilir (bkz.
// lib/logger.ts > captureJsonBody). Klonu arka planda okumayı denemek
// HER ZAMAN boş gövde döndürüyordu — yanıt gönderildikten sonra akış yok
// ediliyor.

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export type ActivityInput = {
  cookieHeader: string | null;
  routeLabel: string;
  method: string;
  url: string | undefined;
  status: number;
  durationMs: number;
  /** Handler'dan ÖNCE okunmuş JSON gövdesi — özet bundan üretilir. */
  rawBody: string | null;
};

/**
 * Yazma isteğini kaydeder. HİÇBİR ZAMAN hata fırlatmaz ve BEKLETİLMEZ —
 * kayıt tutmak kullanıcının isteğini yavaşlatmamalı ya da bozmamalıdır.
 */
export function recordActivity(input: ActivityInput): void {
  if (!MUTATING.has(input.method.toUpperCase())) return;
  const cookieHeader = input.cookieHeader;
  if (!cookieHeader || !cookieHeader.includes(`${SESSION_COOKIE_NAME}=`)) return;

  void (async () => {
    try {
      const sessionToken = readCookie(cookieHeader, SESSION_COOKIE_NAME);
      const session = sessionToken ? await verifySessionToken(sessionToken) : null;
      if (!session) return;
      // ⚠️ Yalnızca yönetici eylemleri (yukarıdaki gerekçe).
      if (session.role !== "ADMIN") return;

      // Yönetici başka birinin panelindeyse: aktör YÖNETİCİ, onBehalfOf
      // paneline girilen kişidir — "yönetici tarafından yapıldı" etiketi.
      let onBehalfOf: { id: string; role: string; name: string } | null = null;
      if (cookieHeader.includes(`${IMPERSONATION_COOKIE_NAME}=`)) {
        const raw = readCookie(cookieHeader, IMPERSONATION_COOKIE_NAME);
        const view = raw ? await verifyImpersonationToken(raw) : null;
        // Aynı doğrulama zinciri: görüntülemeyi başlatan, bu çerezin sahibi
        // yöneticiyle AYNI kişi olmalı ve kurumlar eşleşmeli.
        if (view && view.by === session.sub && view.institutionId === session.institutionId) {
          onBehalfOf = { id: view.sub, role: view.role, name: view.name };
        }
      }

      const path = input.url ? new URL(input.url).pathname : "";

      const described = await describeAdminAction({ method: input.method, path, rawBody: input.rawBody });

      await prisma.activityLog.create({
        data: {
          institutionId: session.institutionId,
          actorId: session.sub,
          actorRole: session.role,
          actorName: session.name ?? "",
          onBehalfOfId: onBehalfOf?.id ?? null,
          onBehalfOfRole: onBehalfOf?.role ?? null,
          onBehalfOfName: onBehalfOf?.name ?? null,
          method: input.method.toUpperCase(),
          route: input.routeLabel,
          path,
          status: input.status,
          durationMs: Math.round(input.durationMs),
          summary: described.summary,
          category: described.category,
          details: described.details as object,
        },
      });
    } catch {
      // Kayıt yazılamadıysa istek yine de başarılıdır — sessizce geçilir.
      // (logger'ı buradan çağırmak döngüsel bağımlılık yaratır.)
    }
  })();
}
