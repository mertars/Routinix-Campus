import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";
import { notify, actorNameOf, parentsOf, studentAndParents } from "@/lib/server/notifications/activity";

export const dynamic = "force-dynamic";

// GUIDANCE MEETINGS — rehberlik görüşme takvimi.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15): "rehberlik çok yetkisiz, üstelik görüşme
// de açamıyor, programını kimle ne zaman görüşecek göremiyor". Sistemde
// randevu olarak yalnızca AppointmentRequest vardı ve o ÖĞRENCİNİN etüt
// isteme akışı — gün ADI tutuyor, gerçek tarihi yok (bkz. schema.prisma >
// GuidanceMeeting üstündeki not).
//
// Yetki: yalnızca rehberlik ve yönetici. Rehberlik kurum genelinde çalışır
// (şubeye bağlı değil — bkz. session-guard > assertCanReadBranch merdiveni),
// bu yüzden öğrenci kontrolü "aynı kurumda mı" ile sınırlıdır.
//
// ⚠️ Liste HER ZAMAN oturumdan gelen danışmana (session.sub) kilitlidir;
// counselorId parametre olarak KABUL EDİLMEZ — bir rehber öğretmen başka
// birinin görüşme takvimini okuyamaz. Yönetici kurum genelini görür.

const createSchema = z.object({
  studentId: z.string().min(1),
  // ISO 8601 — arayüz <input type="datetime-local"> değerini yerel saatle gönderir.
  scheduledAt: z.string().min(1),
  durationMin: z.number().int().min(5).max(240).optional(),
  topic: z.string().trim().min(1, "Görüşme konusu zorunludur.").max(300),
  category: z.enum(["ACADEMIC", "PSYCHOLOGICAL", "DISCIPLINARY"]).optional(),
  // Görüşmeye kim çağrıldı — veli görüşmesi de hep BİR ÖĞRENCİ hakkındadır
  // (bkz. schema.prisma > GuidanceMeeting.attendee).
  attendee: z.enum(["STUDENT", "PARENT", "BOTH"]).optional(),
});

async function handleGet(request: NextRequest) {
  try {
    const session = await requireSession();
    requireRole(session, "guidance", "principal");

    // Varsayılan pencere: 7 gün geriden 30 gün ileriye — takvim ekranının
    // ihtiyacı bu; "tüm geçmiş" istemek büyük kurumda gereksiz yük.
    const fromParam = request.nextUrl.searchParams.get("from");
    const toParam = request.nextUrl.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 7 * 86400_000);
    const to = toParam ? new Date(toParam) : new Date(Date.now() + 30 * 86400_000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: "Geçersiz tarih aralığı." }, { status: 400 });
    }

    const meetings = await prisma.guidanceMeeting.findMany({
      where: {
        scheduledAt: { gte: from, lte: to },
        student: { institutionId: session.institutionId },
        // Rehber kendi takvimini görür; yönetici kurumun tamamını.
        ...(session.role === "GUIDANCE" ? { counselorId: session.sub } : {}),
      },
      select: {
        id: true,
        scheduledAt: true,
        durationMin: true,
        topic: true,
        category: true,
        status: true,
        outcomeNote: true,
        attendee: true,
        counselor: { select: { id: true, firstName: true, lastName: true } },
        student: {
          select: { id: true, firstName: true, lastName: true, branch: { select: { name: true } } },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json({
      meetings: meetings.map((m) => ({
        id: m.id,
        scheduledAt: m.scheduledAt.toISOString(),
        durationMin: m.durationMin,
        topic: m.topic,
        category: m.category,
        status: m.status,
        attendee: m.attendee,
        outcomeNote: m.outcomeNote,
        counselorName: `${m.counselor.firstName} ${m.counselor.lastName}`,
        studentId: m.student.id,
        studentName: `${m.student.firstName} ${m.student.lastName}`,
        branchName: m.student.branch?.name ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_meetings_list_failed", error);
  }
}

async function handlePost(request: NextRequest) {
  try {
    const session = await requireSession();
    // Görüşmeyi AÇAN her zaman rehberliktir — yönetici başkası adına
    // randevu oluşturamaz (takvim sahibinin kendi işi).
    requireRole(session, "guidance");

    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Eksik alan." }, { status: 400 });
    }
    const { studentId, scheduledAt, durationMin, topic, category, attendee } = parsed.data;

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: "Geçersiz görüşme tarihi." }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { institutionId: true, firstName: true, lastName: true },
    });
    if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
    requireInstitution(session, student.institutionId);

    const meeting = await prisma.guidanceMeeting.create({
      data: {
        studentId,
        counselorId: session.sub,
        scheduledAt: when,
        durationMin: durationMin ?? 30,
        topic,
        category: category ?? "ACADEMIC",
        attendee: attendee ?? "STUDENT",
      },
      select: { id: true, scheduledAt: true },
    });

    // Öğrenci randevusunu BİLMELİ — haberi olmayan öğrenci gelmez ve
    // görüşme "gelmedi" diye kapanır. notifyOnce: aynı görüşme için
    // mükerrer bildirim yazılmaz.
    const actor = await actorNameOf(session.role, session.sub);
    // ⚠️ Bildirim KATILIMCIYA gider. Veli görüşmesini öğrenciye haber
    // vermek işe yaramaz — gelmesi gereken veli, haberi olması gereken de o.
    const recipients =
      attendee === "PARENT"
        ? await parentsOf(studentId)
        : attendee === "BOTH"
          ? await studentAndParents(studentId)
          : [{ role: "STUDENT" as const, id: studentId }];
    await notify({
      institutionId: session.institutionId,
      recipients,
      eventType: "guidance.meeting_scheduled",
      title: "Rehberlik görüşmesi planlandı",
      body: `${when.toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · ${topic}`,
      href: "/student",
      actorName: actor,
    });

    return NextResponse.json({ id: meeting.id }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_meeting_create_failed", error);
  }
}

export const GET = withApiLogging("GET /api/guidance/meetings", handleGet);
export const POST = withApiLogging("POST /api/guidance/meetings", handlePost);
