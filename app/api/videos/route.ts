import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getObjectStream, deleteObject } from "@/lib/server/r2";
import { uploadToYoutube, checkYoutubeProcessingStatus } from "@/lib/server/youtube";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Büyük videolarda R2→YouTube aktarımı birkaç dakika sürebilir — Vercel'in
// varsayılan zaman aşımı süresine (10sn) bilerek güvenilmiyor. Hobby planda
// Vercel bunu zaten 60sn'ye sabitliyor (planın kendi sınırı) — Pro/Enterprise
// planda gerçekten 300sn'ye kadar çalışır.
export const maxDuration = 300;

// GET /api/videos — kurumun video kütüphanesi (yönetici VE öğretmen
// görebilir, sadece yönetici ekleyebilir — bkz. POST). Öğrenci BURAYA
// değil, /api/videos/assigned'a (SADECE kendine atanmışlar) erişir.
async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal", "teacher");

    const videos = await prisma.video.findMany({
      where: { institutionId: session.institutionId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        description: true,
        grade: true,
        subject: true,
        topic: true,
        youtubeId: true,
        status: true,
        failureReason: true,
        createdAt: true,
      },
    });

    // Kullanıcı geri bildirimi (2026-09-04) — YouTube video baytlarını
    // alması ile videonun GERÇEKTEN oynatılabilir olması ayrı şeyler. Hâlâ
    // "PROCESSING" görünen videoları her listelemede YouTube'dan taze
    // kontrol edip DB'yi güncelliyoruz — ayrı bir arka plan işi/cron
    // GEREKMİYOR, zaten kütüphaneyi açık tutan yönetici birkaç saniyede
    // bir bu ucu çağırıyor (bkz. video-portal-panel.tsx'teki polling).
    //
    // Sağlamlaştırma (2026-09-05) — eskiden bir video, durum kontrolü HER
    // ÇAĞRIDA başarısız olursa (kota doldu, refresh token iptal oldu, ağ
    // hatası) SONSUZA KADAR "PROCESSING" kalabiliyordu. Artık yükleme
    // anından (createdAt) bu yana STUCK_THRESHOLD_MS'den fazla geçmişse ve
    // hâlâ hazır değilse, FAILED'e çevrilip gerekçesi kaydediliyor — hiçbir
    // video sonsuza dek "hazırlanıyor" görünmüyor. youtubeId'si HÂLÂ null
    // olan satırlar (R2→YouTube aktarımı sunucusuz fonksiyon öldürülerek
    // yarıda kesilmiş olabilir, bkz. POST altındaki gerekçe) kontrol
    // edilecek bir YouTube kaydı olmadığı için doğrudan aynı zaman aşımı
    // mantığına tabi.
    const STUCK_THRESHOLD_MS = 20 * 60 * 1000;
    const stillProcessing = videos.filter((v) => v.status === "PROCESSING");
    if (stillProcessing.length > 0) {
      const now = Date.now();
      const updates = await Promise.all(
        stillProcessing.map(async (v) => {
          const stuck = now - v.createdAt.getTime() > STUCK_THRESHOLD_MS;
          if (!v.youtubeId) {
            return stuck ? { id: v.id, status: "FAILED" as const, reason: "Yükleme tamamlanamadı (zaman aşımı)." } : null;
          }
          const check = await checkYoutubeProcessingStatus(v.youtubeId).catch((error) => ({
            status: "PROCESSING" as const,
            reason: error instanceof Error ? error.message : "Bilinmeyen hata",
          }));
          if (check.status !== "PROCESSING") return { id: v.id, status: check.status, reason: check.reason };
          if (stuck) return { id: v.id, status: "FAILED" as const, reason: check.reason ?? "Zaman aşımı — YouTube işlemesi çok uzun sürdü." };
          return null;
        })
      );
      const changed = updates.filter((u): u is { id: string; status: "READY" | "FAILED"; reason: string | undefined } => u !== null);
      if (changed.length > 0) {
        await Promise.all(
          changed.map((u) =>
            prisma.video.update({ where: { id: u.id }, data: { status: u.status, failureReason: u.status === "FAILED" ? (u.reason ?? null) : null } }).catch(() => {})
          )
        );
        const byId = new Map(changed.map((u) => [u.id, u]));
        for (const v of videos) {
          const next = byId.get(v.id);
          if (next) {
            v.status = next.status;
            v.failureReason = next.status === "FAILED" ? (next.reason ?? null) : null;
          }
        }
      }
    }

    return NextResponse.json({ videos });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_list_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

// POST /api/videos — { title, description?, grade, subject, topic, r2Key }
// — tarayıcı R2'ye (geçici tampon, bkz. /api/videos/presign) YÜKLEMEYİ
// BİTİRDİKTEN SONRA çağırır. Bu uç: 1) DB kaydını (youtubeId=null,
// PROCESSING) YouTube aktarımı BAŞLAMADAN ÖNCE oluşturur, 2) R2'deki
// nesneyi bir akış olarak okuyup YouTube'a (gizli/liste dışı) aktarır,
// 3) R2'den siler, 4) kaydı YouTube video ID'siyle günceller. Yönetici
// hiçbir aşamada YouTube'u GÖRMEZ.
//
// Sağlamlaştırma (2026-09-05) — eskiden DB kaydı aktarım TAMAMEN
// BİTTİKTEN SONRA oluşturuluyordu: sunucusuz fonksiyon aktarımın
// ORTASINDA öldürülürse (ör. Vercel'in süre sınırı — bkz. maxDuration
// altındaki not), YouTube dosyayı almış olsa BİLE veritabanında hiçbir
// iz kalmıyordu, tamamen görünmez/kurtarılamaz oluyordu. Kayıt artık
// EN BAŞTA oluşturulduğu için böyle bir kesinti en azından yönetici
// panelinde görünen, yeniden denenebilir/silinebilir bir satır bırakıyor.
async function handlePost(request: NextRequest) {
  let r2Key: string | undefined;
  let videoId: string | undefined;
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const grade = Number(body?.grade);
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
    const description = typeof body?.description === "string" && body.description.trim() ? body.description.trim() : "";
    r2Key = typeof body?.r2Key === "string" ? body.r2Key.trim() : "";

    if (!title || !subject || !topic || !r2Key || !Number.isInteger(grade) || grade < 1 || grade > 12) {
      return NextResponse.json({ error: "title, grade (1-12), subject, topic ve r2Key zorunludur." }, { status: 400 });
    }
    // r2Key'in GERÇEKTEN bu kuruma ait bir presign isteğinden geldiğini
    // doğrular — başka bir kurumun anahtarını kullanmaya çalışmayı engeller.
    if (!r2Key.startsWith(`staging/${session.institutionId}/`)) {
      return NextResponse.json({ error: "Geçersiz r2Key." }, { status: 400 });
    }

    const created = await prisma.video.create({
      data: { institutionId: session.institutionId, title, description: description || null, grade, subject, topic, youtubeId: null, createdById: session.sub },
    });
    videoId = created.id;

    const staged = await getObjectStream(r2Key);
    let youtubeId: string;
    try {
      youtubeId = await uploadToYoutube({
        title,
        description: description || `${subject} — ${topic} (${grade}. Sınıf)`,
        body: staged.body,
        contentLength: staged.contentLength,
        contentType: staged.contentType,
      });
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError);
      const reason = /quota/i.test(message) ? "YouTube günlük yükleme kotası doldu, yarın tekrar deneyin." : "Video YouTube'a aktarılamadı.";
      const failed = await prisma.video.update({ where: { id: created.id }, data: { status: "FAILED", failureReason: reason } });
      logger.error("video_youtube_upload_failed", { error: message, videoId: created.id });
      return NextResponse.json({ error: reason, video: failed }, { status: 502 });
    }

    const video = await prisma.video.update({ where: { id: created.id }, data: { youtubeId } });
    return NextResponse.json({ video });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_create_failed", { error: error instanceof Error ? error.message : String(error) });
    if (videoId) await prisma.video.update({ where: { id: videoId }, data: { status: "FAILED", failureReason: "Beklenmeyen hata" } }).catch(() => {});
    return NextResponse.json({ error: "Video eklenemedi." }, { status: 500 });
  } finally {
    // Başarılı da olsa başarısız da olsa geçici R2 nesnesi TEMİZLENİR —
    // kalıcı depolama değil, iz bırakmamalı.
    if (r2Key) await deleteObject(r2Key).catch(() => {});
  }
}

export const GET = withApiLogging("GET /api/videos", handleGet);
export const POST = withApiLogging("POST /api/videos", handlePost);
