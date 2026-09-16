import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { requireSession, requireRole, requireInstitution, assertOwnsSelf } from "@/lib/server/auth/session-guard";
import { AuthError, authErrorResponse } from "@/lib/server/auth/errors";
import { withApiLogging } from "@/lib/logger";
import { apiFailure } from "@/lib/server/api-failure";

export const dynamic = "force-dynamic";

// POST /api/guidance-program/entries/[id]/open — bloğu AÇ.
//
// ⚠️ NEDEN VAR (Mert, 2026-09-15: "video tuşu hâlâ çalışmıyor, basınca
// video açılmalı" / "röntgen tuşuna basınca test açılmalı"):
//
// Blok, gideceği yere doğrudan LİNK veremiyordu çünkü hedef her zaman
// hazır değildi. Canlı veride ölçüldü:
//   * Bir VIDEO bloğunun videoId'si vardı ama VideoAssignment'ı YOKTU
//     (program, atama üretme özelliğinden ÖNCE yazılmıştı). Öğrenci "İzle"ye
//     basınca video sekmesine gidiyor, o sekme SADECE atanmış videoları
//     listelediği için video orada olmuyor ve hiçbir şey açılmıyordu.
//   * Bir XRAY bloğunun ataması yoktu (o kazanımın soru havuzu boştu).
//
// Bu uç hedefi AÇMADAN ÖNCE GARANTİ EDER: atama yoksa oluşturur, sonra
// nereye gidileceğini söyler. Böylece eski bloklar da, ileride oluşabilecek
// boşluklar da tek yerde kapanır — her blokta ayrı ayrı kontrol etmek
// yerine.
//
// ⚠️ Yetki: yalnızca öğrencinin KENDİ programındaki blok.
async function handlePost(_request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireSession();
    requireRole(session, "student");

    const entry = await prisma.guidanceProgramEntry.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        kind: true,
        subject: true,
        subtopicId: true,
        videoId: true,
        xrayAssignmentId: true,
        video: { select: { id: true, youtubeId: true, status: true } },
        program: { select: { studentId: true, student: { select: { institutionId: true } } } },
      },
    });
    if (!entry) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    requireInstitution(session, entry.program.student.institutionId);
    assertOwnsSelf(session, entry.program.studentId);
    const studentId = entry.program.studentId;

    if (entry.kind === "VIDEO") {
      if (!entry.videoId || !entry.video?.youtubeId || entry.video.status !== "READY") {
        return NextResponse.json({ error: "Bu videonun kaydı eksik — rehberlik öğretmeninize bildirin." }, { status: 400 });
      }
      // Atama yoksa ŞİMDİ oluştur (eski bloklar için). Varsa dokunma —
      // izleme ilerlemesi korunmalı.
      await prisma.videoAssignment.upsert({
        where: { videoId_studentId: { videoId: entry.videoId, studentId } },
        update: {},
        create: { videoId: entry.videoId, studentId },
      });
      return NextResponse.json({ url: `/student?tab=videos&video=${entry.videoId}` });
    }

    if (entry.kind === "XRAY_TEST") {
      if (entry.xrayAssignmentId) {
        return NextResponse.json({ url: `/student/comprehension/${entry.xrayAssignmentId}` });
      }
      if (!entry.subtopicId) {
        return NextResponse.json({ error: "Bu blokta röntgen konusu seçilmemiş." }, { status: 400 });
      }
      // Soru havuzu boşsa test AÇILAMAZ — sahte bir sınav başlatmak yerine
      // öğrenciye nedenini söyle.
      const questionCount = await prisma.xrayComprehensionQuestion.count({
        where: { subject: entry.subject, subtopicId: entry.subtopicId },
      });
      if (questionCount === 0) {
        return NextResponse.json(
          { error: "Bu konunun soru havuzu henüz boş — test açılamıyor. Bloğu 'yaptım' olarak işaretleyebilirsin." },
          { status: 400 }
        );
      }
      const created = await prisma.xrayComprehensionAssignment.create({
        data: { studentId, subject: entry.subject, subtopicId: entry.subtopicId },
        select: { id: true },
      });
      await prisma.guidanceProgramEntry.update({ where: { id: entry.id }, data: { xrayAssignmentId: created.id } });
      return NextResponse.json({ url: `/student/comprehension/${created.id}` });
    }

    return NextResponse.json({ error: "Bu blok türü açılamaz." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    return apiFailure("guidance_program_entry_open_failed", error);
  }
}

export const POST = withApiLogging("POST /api/guidance-program/entries/[id]/open", handlePost);
