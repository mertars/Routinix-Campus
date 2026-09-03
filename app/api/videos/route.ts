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
      select: { id: true, title: true, description: true, grade: true, subject: true, topic: true, youtubeId: true, status: true, createdAt: true },
    });

    // Kullanıcı geri bildirimi (2026-09-04) — YouTube video baytlarını
    // alması ile videonun GERÇEKTEN oynatılabilir olması ayrı şeyler. Hâlâ
    // "PROCESSING" görünen videoları her listelemede YouTube'dan taze
    // kontrol edip DB'yi güncelliyoruz — ayrı bir arka plan işi/cron
    // GEREKMİYOR, zaten kütüphaneyi açık tutan yönetici birkaç saniyede
    // bir bu ucu çağırıyor (bkz. video-portal-panel.tsx'teki polling).
    const stillProcessing = videos.filter((v) => v.status === "PROCESSING");
    if (stillProcessing.length > 0) {
      const updates = await Promise.all(
        stillProcessing.map(async (v) => {
          const status = await checkYoutubeProcessingStatus(v.youtubeId).catch(() => "PROCESSING" as const);
          return { id: v.id, status };
        })
      );
      const changed = updates.filter((u) => u.status !== "PROCESSING");
      if (changed.length > 0) {
        await Promise.all(changed.map((u) => prisma.video.update({ where: { id: u.id }, data: { status: u.status } }).catch(() => {})));
        const statusById = new Map(changed.map((u) => [u.id, u.status]));
        for (const v of videos) {
          const next = statusById.get(v.id);
          if (next) v.status = next;
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
// BİTİRDİKTEN SONRA çağırır. Bu uç: 1) R2'deki nesneyi bir akış olarak
// okur, 2) YouTube'a (gizli/liste dışı) aktarır, 3) R2'den siler, 4)
// YouTube video ID'siyle veritabanı kaydını oluşturur. Yönetici hiçbir
// aşamada YouTube'u GÖRMEZ.
async function handlePost(request: NextRequest) {
  let r2Key: string | undefined;
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

    const staged = await getObjectStream(r2Key);
    const youtubeId = await uploadToYoutube({
      title,
      description: description || `${subject} — ${topic} (${grade}. Sınıf)`,
      body: staged.body,
      contentLength: staged.contentLength,
      contentType: staged.contentType,
    });

    const video = await prisma.video.create({
      data: { institutionId: session.institutionId, title, description: description || null, grade, subject, topic, youtubeId, createdById: session.sub },
    });

    return NextResponse.json({ video });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("video_create_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Video YouTube'a aktarılamadı." }, { status: 500 });
  } finally {
    // Başarılı da olsa başarısız da olsa geçici R2 nesnesi TEMİZLENİR —
    // kalıcı depolama değil, iz bırakmamalı.
    if (r2Key) await deleteObject(r2Key).catch(() => {});
  }
}

export const GET = withApiLogging("GET /api/videos", handleGet);
export const POST = withApiLogging("POST /api/videos", handlePost);
