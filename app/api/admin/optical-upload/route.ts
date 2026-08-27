import { NextRequest, NextResponse } from "next/server";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// ⚠️ Bu uç bir önceki sürümde dosya İÇERİĞİNİ hiç okumadan, her öğrenci
// için Math.random() ile SAHTE bir net üretip veritabanına KALICI olarak
// yazıyordu — arayüzde gerçek bir yükleme gibi görünüyordu (ilerleme
// animasyonu, "şube ortalamaları güncellendi" mesajı) ama öğrenci/veli
// panelinde gerçek performans verisiymiş gibi görünen uydurma sayılar
// kalıcı hale geliyordu. Gerçek PDF ayrıştırıcı tasarlanana kadar (bkz.
// ilgili konuşma) bu uç BİLEREK devre dışı — sahte veri üretmektense
// net bir hata döndürmek daha güvenlidir. Şu an için gerçek net girişi
// bkz. POST /api/exams/[id]/net-results (öğretmen, satır satır elle giriş).
async function handlePost() {
  try {
    const session = await requireSession();
    requireRole(session, "principal");
    return NextResponse.json(
      { error: "Optik okuma ile toplu içe aktarma henüz hazır değil. Şimdilik netleri Sınav Yönetimi ekranından elle girin." },
      { status: 501 }
    );
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_optical_upload_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/optical-upload", handlePost);
