import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendBulkNotification } from "@/lib/server/sms/notification-service";
import { requireSession, requireRole, assertTeacherOwnsStudent } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging, logger } from "@/lib/logger";

const bodySchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["ABSENT", "LATE"]),
});

const DURUM_TEXT: Record<"ABSENT" | "LATE", string> = {
  ABSENT: "bugün okula gelmedi",
  LATE: "bugün derse geç kaldı",
};

// POST /api/teacher/notify-absence — Canlı Yoklama ekranındaki "Veliye
// Bildir" tuşu.
//
// ⚠️ Bu tuş daha önce SAHTEYDİ: hiçbir istek atmıyor, 1 saniye bekleyip
// "Ulaştı" gösteriyordu (bkz. components/teacher/tabs/live-attendance.tsx
// eski NotifyButton). Yönetici tarafında (attendance-command.tsx) AYNI
// işi yapan bir NotifyButton zaten gerçek ve üretimde çalışıyor — bu uç
// öğretmen tarafını ona bağlar, sıfırdan bir gönderim yolu icat etmez.
//
// /api/notifications/send DOĞRUDAN açılmadı: o uç principal'a serbest
// scopeType + templateBody veriyor. Öğretmene aynen açılsaydı (a) kendi
// öğretmediği bir öğrenciye mesaj atabilir, (b) SMS metnini kendi yazıp
// kurumun kontörüyle istediğini gönderebilirdi. Bu uç yalnızca TEK bir
// şeyi yapar: kendi öğrettiği bir öğrencinin velisine, SUNUCUNUN
// belirlediği sabit bir devamsızlık metniyle haber verir.
async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "teacher");
    const teacherId = session.sub;

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz istek gövdesi", details: parsed.error.flatten() }, { status: 400 });
    }
    const { studentId, status } = parsed.data;

    // Kurum sınırı + "gerçekten bu öğretmenin öğrencisi mi" — ödev/karne/
    // materyal uçlarındaki AYNI kontrol (bkz. session-guard.ts).
    await assertTeacherOwnsStudent(teacherId, studentId);

    const result = await sendBulkNotification({
      scopeType: "CUSTOM_ID_LIST",
      scopeValue: studentId,
      templateBody: "Sayın {veli_adi}, öğrenciniz {ogrenci_adi} {durum}.",
      extraParams: { durum: DURUM_TEXT[status] },
      institutionId: session.institutionId,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    logger.error("teacher_notify_absence_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Beklenmeyen hata" }, { status: 500 });
  }
}

export const POST = withApiLogging("POST /api/teacher/notify-absence", handlePost);
