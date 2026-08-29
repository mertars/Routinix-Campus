import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { resolveScope } from "@/lib/server/sms/scope-resolver";
import { sendBulkNotification } from "@/lib/server/sms/notification-service";
import { requireSession, requireRole } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/admin/sms/send — Toplu SMS ekranının gönderim ucu. Body:
// { studentIds: string[], message: string }. Genel amaçlı
// /api/notifications/send'i (scopeType/scopeValue tabanlı) DOĞRUDAN
// kullanmak yerine kendi ince sarmalayıcısı var, çünkü bu ekrana özgü İKİ ek
// kural gerekiyor: (1) çağıran taraf öğrenci ID listesi verir, biz bunu
// CUSTOM_ID_LIST kapsamına çeviririz — scopeType/scopeValue'yu doğrudan
// bilmesi gerekmez; (2) kurumun SMS kontürü (Institution.smsCredits) burada
// kontrol edilip düşülür. Bu kontör mantığı BİLEREK paylaşılan
// sendBulkNotification'ın İÇİNE değil, sadece bu uca eklendi — aksi halde
// zaten üretimde çalışan tek gerçek çağıran (attendance-command.tsx'teki
// NotifyButton, tek öğrenciye anlık devamsızlık SMS'i) kontür sıfır olan
// (seed'de hiç ayarlanmamış) kurumlarda aniden çalışmaz hale gelirdi.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "principal");

    const body = await request.json();
    const { studentIds, message } = body as { studentIds?: string[]; message?: string };
    if (!Array.isArray(studentIds) || studentIds.length === 0 || !message?.trim()) {
      return NextResponse.json({ error: "studentIds (en az bir öğrenci) ve message zorunludur." }, { status: 400 });
    }

    const scopeValue = studentIds.join(",");
    const recipients = await resolveScope("CUSTOM_ID_LIST", scopeValue, session.institutionId);
    if (recipients.length === 0) {
      return NextResponse.json({ error: "Seçili öğrencilerin velisinde SMS onayı (smsConsent) yok." }, { status: 400 });
    }

    const institution = await prisma.institution.findUnique({ where: { id: session.institutionId }, select: { smsCredits: true } });
    const availableCredits = institution?.smsCredits ?? 0;
    if (availableCredits < recipients.length) {
      return NextResponse.json(
        { error: `Yetersiz SMS kontörü: ${recipients.length} alıcı için kontör gerekiyor, mevcut bakiye ${availableCredits}.` },
        { status: 402 }
      );
    }

    // Not: eşzamanlı iki gönderim arasında bir yarış durumu teorik olarak
    // mümkün (her ikisi de kontrolü aynı anda geçebilir) — yönetici panelinde
    // tek oturumdan yönetilen düşük hacimli bir işlem olduğundan (bkz.
    // etut-management'teki AYNI basit "kontrol et, sonra yaz" deseni)
    // transaction/kilitleme ile ağırlaştırılmadı.
    await prisma.institution.update({
      where: { id: session.institutionId },
      data: { smsCredits: { decrement: recipients.length } },
    });

    const result = await sendBulkNotification({
      institutionId: session.institutionId,
      scopeType: "CUSTOM_ID_LIST",
      scopeValue,
      templateBody: message.trim(),
    });

    return NextResponse.json({ ...result, remainingCredits: availableCredits - recipients.length }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("admin_sms_send_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/admin/sms/send", handlePost);
