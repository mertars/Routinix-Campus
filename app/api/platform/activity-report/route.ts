import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requirePlatformSession, requirePlatformInstitution } from "@/lib/server/auth/platform-session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// ETKİNLİK RAPORU — "kim, ne zaman, hangi veriyi girdi/değiştirdi".
//
// ⚠️ NEDEN PLATFORM TARAFINDA (Mert, 2026-09-17): "olası bir öğretmen
// şikâyetinde kendi /platform hesabımdan rapor çıkarıp kimin ne yaptığını
// kanıt olarak sunabileyim." Rapor bir KANIT belgesidir; kurumun kendi
// yöneticisinin de eylemlerini içerdiği için, o yöneticinin erişemeyeceği
// bir yerde durması gerekir. Yönetici kendi hakkındaki kaydı ne
// görebilmeli ne de dolaylı olarak etkileyebilmeli.
//
// ⚠️ 90 GÜN: kayıtlar bundan eskisini tutmuyor (bkz. cron/activity-prune),
// bu yüzden aralık istenirse de o sınırın dışına çıkılamaz.
//
// ⚠️ TABLO ARTIK SADECE YÖNETİCİ EYLEMLERİNİ TUTUYOR (Mert, 2026-09-17:
// "zaten yönetici yapmadıysa kişi kendi yapmıştır"). Rapor da bu yüzden
// "kim yaptı" değil "yönetici NE yaptı" sorusuna cevap verir.

const MAX_RANGE_DAYS = 92;
const DETAIL_LIMIT = 500;

/** Rota etiketini insan diline çevirir — "POST /api/attendance" → "Yoklama girdi". */
const ACTION_LABEL: { test: RegExp; label: string }[] = [
  { test: /\/api\/attendance/, label: "Yoklama" },
  { test: /\/api\/homework/, label: "Ödev" },
  { test: /\/api\/exams?/, label: "Sınav / deneme" },
  { test: /\/api\/guidance-program/, label: "Çalışma programı" },
  { test: /\/api\/guidance-notes/, label: "Rehberlik notu" },
  { test: /\/api\/guidance/, label: "Rehberlik" },
  { test: /\/api\/payments|\/api\/installments|\/api\/collections/, label: "Ödeme / tahsilat" },
  { test: /\/api\/quizzes/, label: "Pop-quiz" },
  { test: /\/api\/videos/, label: "Video" },
  { test: /\/api\/xray/, label: "Akademik röntgen" },
  { test: /\/api\/questions/, label: "Soru çözüm" },
  { test: /\/api\/announcements|\/api\/sms/, label: "Duyuru / SMS" },
  { test: /\/api\/admin\/users|\/api\/admin\/branches/, label: "Kullanıcı / şube yönetimi" },
  { test: /\/api\/admin\/impersonate/, label: "Panel görüntüleme" },
  { test: /\/api\/materials|\/api\/classbook|\/api\/yearly-plan/, label: "Ders materyali / defter" },
  { test: /\/api\/appointments|\/api\/etut/, label: "Etüt / randevu" },
];

function actionLabel(path: string): string {
  return ACTION_LABEL.find((a) => a.test.test(path))?.label ?? "Diğer";
}

async function handleGet(request: NextRequest) {
  try {
    await requirePlatformSession();
    const params = request.nextUrl.searchParams;
    const institutionId = params.get("institutionId");
    if (!institutionId) throw new AuthError("Kurum seçilmedi.", "MISSING_FIELDS", 400);
    const institution = await requirePlatformInstitution(institutionId);

    // Dönem: gün / hafta / ay / 3 ay (Mert'in istediği dört seçenek).
    const period = params.get("period") ?? "week";
    const days = period === "day" ? 1 : period === "week" ? 7 : period === "month" ? 30 : 90;
    const from = new Date(Date.now() - Math.min(days, MAX_RANGE_DAYS) * 86_400_000);
    const actorId = params.get("actorId");

    const where = {
      institutionId,
      createdAt: { gte: from },
      ...(actorId ? { actorId } : {}),
    };

    const [byActor, rows, total] = await Promise.all([
      // Kişi bazlı toplam — raporun özeti.
      prisma.activityLog.groupBy({
        by: ["actorId", "actorName", "actorRole"],
        where,
        _count: { _all: true },
        orderBy: { _count: { actorId: "desc" } },
      }),
      // Döküm — kanıt olarak sunulacak satırlar.
      prisma.activityLog.findMany({
        where,
        select: {
          id: true,
          actorId: true,
          actorName: true,
          actorRole: true,
          onBehalfOfName: true,
          onBehalfOfRole: true,
          method: true,
          route: true,
          path: true,
          status: true,
          createdAt: true,
          summary: true,
          category: true,
          details: true,
        },
        orderBy: { createdAt: "desc" },
        take: DETAIL_LIMIT,
      }),
      prisma.activityLog.count({ where }),
    ]);

    // Gün bazlı dağılım — "hangi gün ne kadar iş yapıldı" grafiği için.
    const byDay = new Map<string, number>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }

    return NextResponse.json({
      institution: { id: institution.id, name: institution.name },
      period,
      from: from.toISOString(),
      to: new Date().toISOString(),
      total,
      truncated: total > rows.length,
      byActor: byActor.map((a) => ({
        actorId: a.actorId,
        actorName: a.actorName,
        actorRole: a.actorRole,
        count: a._count._all,
      })),
      byDay: [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
      rows: rows.map((r) => ({
        id: r.id,
        at: r.createdAt.toISOString(),
        actorId: r.actorId,
        actorName: r.actorName,
        actorRole: r.actorRole,
        // ⚠️ "Yönetici tarafından yapıldı" etiketi — şikâyet çözmenin
        // asıl anahtarı bu alan.
        onBehalfOfName: r.onBehalfOfName,
        onBehalfOfRole: r.onBehalfOfRole,
        // ⚠️ Özet KAYIT ANINDA üretilip donduruldu (bkz.
        // lib/server/activity/describe.ts) — rapor anında yeniden
        // üretilemez, çünkü o an silinmiş bir şubenin adı artık bulunamaz.
        summary: r.summary ?? actionLabel(r.path),
        category: r.category ?? actionLabel(r.path),
        details: r.details,
        action: r.category ?? actionLabel(r.path),
        method: r.method,
        route: r.route,
        status: r.status,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("activity_report_failed", error);
  }
}

export const GET = withApiLogging("GET /api/platform/activity-report", handleGet);
